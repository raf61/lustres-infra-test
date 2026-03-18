/**
 * Regras para atribuição de vendedores a clientes.
 * 
 * Este módulo centraliza TODA a lógica de atribuição de vendedores.
 * 
 * Comportamento:
 * - Atribui vendedorId ao cliente
 * - Para EXPLORADOS: seta visivelDashVendedor = true imediatamente
 *   (porque explorados sempre devem aparecer no dashboard)
 * - Para ATIVOS/AGENDADOS: verifica se está dentro da janela de aparição
 *   (usa regras centralizadas de vendor-dashboard-rules.ts)
 *   - Se está na janela → visivelDashVendedor = true + INDASH
 *   - Se não está → visivelDashVendedor = false (cron cuida depois)
 * - Registra histórico quando apropriado
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import { registrarHistoricoBatch, type HistoricoEntry } from "./vendor-history"
import {
  deveAparecerAtivoDashboard,
  deveAparecerAgendadoDashboard,
} from "./vendor-dashboard-rules"
import { createPrismaKanbanRepository, clearClientKanbanStates } from "./kanban-state-usecase"

// ============================================================================
// TIPOS
// ============================================================================

export interface AssignVendorInput {
  clientIds: number[]
  vendedorId: string
}

export interface AssignVendorResult {
  assigned: number
  visibleInDashboard: number // Total que ficou visível (explorados + ativos/agendados na janela)
  exploradosVisibleInDashboard: number
  ativosAgendadosVisibleInDashboard: number // ATIVOS/AGENDADOS que estão na janela de aparição
  skipped: number
  skippedClients: Array<{ id: number; cnpj: string; razaoSocial: string; reason: string }>
}

export interface ClientForAssignment {
  id: number
  cnpj: string
  razaoSocial: string
  categoria: string | null
  vendedorId: string | null
}

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

/**
 * Categorias que devem aparecer imediatamente no dashboard após atribuição.
 * EXPLORADO sempre aparece, independente de vencimento.
 */
export const CATEGORIAS_APARICAO_IMEDIATA: string[] = ["EXPLORADO"]

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Verifica se a categoria deve aparecer imediatamente no dashboard.
 */
export function deveAparecerImediatamente(categoria: string | null): boolean {
  if (!categoria) return true // Categoria null é tratada como EXPLORADO
  return CATEGORIAS_APARICAO_IMEDIATA.includes(categoria.toUpperCase())
}

// ============================================================================
// FUNÇÃO PRINCIPAL
// ============================================================================

/**
 * Atribui vendedor a múltiplos clientes (batch).
 * 
 * Esta é a função centralizada que deve ser usada para TODA atribuição de vendedor.
 * 
 * Comportamento:
 * 1. Se o cliente estava no dashboard de outro vendedor (visivelDashVendedor = true),
 *    registra OUTDASH para o vendedor anterior
 * 2. Atribui vendedorId a todos os clientes
 * 3. Para EXPLORADOS: seta visivelDashVendedor = true e registra INDASH
 * 4. Para ATIVOS/AGENDADOS: verifica regras de aparição (vendor-dashboard-rules)
 *    - Se está na janela de aparição → visivelDashVendedor = true + INDASH
 *    - Se não está → visivelDashVendedor = false (cron cuida depois)
 * 
 * @param prisma - Cliente Prisma
 * @param input - Dados da atribuição
 * @param excludeIds - IDs a serem excluídos (ex: clientes com ficha em pesquisa)
 */
export async function assignVendorToClients(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: AssignVendorInput,
  excludeIds: number[] = []
): Promise<AssignVendorResult> {
  const { clientIds, vendedorId: novoVendedorId } = input
  const now = new Date()

  if (clientIds.length === 0) {
    return {
      assigned: 0,
      visibleInDashboard: 0,
      exploradosVisibleInDashboard: 0,
      ativosAgendadosVisibleInDashboard: 0,
      skipped: 0,
      skippedClients: [],
    }
  }

  // IDs que serão efetivamente atualizados
  const idsToAssign = clientIds.filter((id) => !excludeIds.includes(id))

  if (idsToAssign.length === 0) {
    return {
      assigned: 0,
      visibleInDashboard: 0,
      exploradosVisibleInDashboard: 0,
      ativosAgendadosVisibleInDashboard: 0,
      skipped: clientIds.length,
      skippedClients: [],
    }
  }

  // Buscar informações dos clientes incluindo ultimaManutencao para verificar regras
  const clients = await prisma.client.findMany({
    where: { id: { in: idsToAssign } },
    select: {
      id: true,
      cnpj: true,
      razaoSocial: true,
      categoria: true,
      vendedorId: true,
      visivelDashVendedor: true,
      ultimaManutencao: true, // Necessário para verificar regras de aparição
    },
  })

  // =========================================================================
  // PASSO 1: Registrar OUTDASH para clientes que estavam no dashboard de OUTRO vendedor
  // =========================================================================
  const clientesComVendedorAnteriorNoDash = clients.filter(
    (c) => c.vendedorId &&
      c.vendedorId !== novoVendedorId &&
      c.visivelDashVendedor === true
  )

  if (clientesComVendedorAnteriorNoDash.length > 0) {
    // Registrar OUTDASH para o vendedor anterior
    const outdashEntries: HistoricoEntry[] = clientesComVendedorAnteriorNoDash.map((client) => ({
      clientId: client.id,
      vendedorId: client.vendedorId!,
      type: "OUTDASH" as const,
      category: client.categoria ?? "EXPLORADO",
      reason: `[${client.categoria ?? "EXPLORADO"}] Transferência para outro vendedor`,
    }))

    await registrarHistoricoBatch(prisma as PrismaClient, outdashEntries)
  }

  // =========================================================================
  // PASSO 2: Separar clientes que JÁ ESTÃO com o mesmo vendedor
  // =========================================================================
  // IMPORTANTE: Não sobrescrever vendedorAlocadoEm para clientes que já estão
  // com o mesmo vendedor, para preservar a data original de alocação.

  const clientesJaComMesmoVendedor = clients.filter((c) => c.vendedorId === novoVendedorId)
  const clientesParaAtribuir = clients.filter((c) => c.vendedorId !== novoVendedorId)

  // IDs dos clientes que já estão com o mesmo vendedor (não atualizar vendedorAlocadoEm)
  const idsJaComMesmoVendedor = new Set(clientesJaComMesmoVendedor.map((c) => c.id))

  // =========================================================================
  // PASSO 3: Separar clientes por comportamento usando REGRAS CENTRALIZADAS
  // =========================================================================

  // Grupo 1: EXPLORADOS - sempre aparecem imediatamente
  const exploradosIds: number[] = []
  const exploradosIdsNovos: number[] = [] // Novos (atualizar vendedorAlocadoEm)
  const exploradosIdsExistentes: number[] = [] // Já com mesmo vendedor (não atualizar)

  // Grupo 2: ATIVOS/AGENDADOS que estão NA JANELA de aparição
  const ativosAgendadosNaJanelaIds: number[] = []
  const ativosAgendadosNaJanelaIdsNovos: number[] = []
  const ativosAgendadosNaJanelaIdsExistentes: number[] = []
  const ativosAgendadosNaJanelaInfo: Array<{ id: number; categoria: string }> = []

  // Grupo 3: ATIVOS/AGENDADOS que NÃO estão na janela (cron cuida depois)
  const ativosAgendadosForaJanelaIds: number[] = []
  const ativosAgendadosForaJanelaIdsNovos: number[] = []
  const ativosAgendadosForaJanelaIdsExistentes: number[] = []

  for (const client of clients) {
    const categoria = (client.categoria ?? "").toUpperCase()
    const jaComMesmoVendedor = idsJaComMesmoVendedor.has(client.id)

    // EXPLORADOS ou sem categoria → sempre aparecem
    if (deveAparecerImediatamente(client.categoria)) {
      exploradosIds.push(client.id)
      if (jaComMesmoVendedor) {
        exploradosIdsExistentes.push(client.id)
      } else {
        exploradosIdsNovos.push(client.id)
      }
      continue
    }

    // ATIVOS/AGENDADOS → verificar regras de aparição
    if (client.ultimaManutencao) {
      let deveAparecer = false

      if (categoria === "ATIVO") {
        // Usa regra centralizada para ATIVOS
        deveAparecer = deveAparecerAtivoDashboard(client.ultimaManutencao, now)
      } else if (categoria === "AGENDADO") {
        // Usa regra centralizada para AGENDADOS
        deveAparecer = deveAparecerAgendadoDashboard(client.ultimaManutencao, now)
      }

      if (deveAparecer) {
        ativosAgendadosNaJanelaIds.push(client.id)
        ativosAgendadosNaJanelaInfo.push({ id: client.id, categoria })
        if (jaComMesmoVendedor) {
          ativosAgendadosNaJanelaIdsExistentes.push(client.id)
        } else {
          ativosAgendadosNaJanelaIdsNovos.push(client.id)
        }
      } else {
        ativosAgendadosForaJanelaIds.push(client.id)
        if (jaComMesmoVendedor) {
          ativosAgendadosForaJanelaIdsExistentes.push(client.id)
        } else {
          ativosAgendadosForaJanelaIdsNovos.push(client.id)
        }
      }
    } else {
      // Sem ultimaManutencao → não pode calcular janela, não aparece
      ativosAgendadosForaJanelaIds.push(client.id)
      if (jaComMesmoVendedor) {
        ativosAgendadosForaJanelaIdsExistentes.push(client.id)
      } else {
        ativosAgendadosForaJanelaIdsNovos.push(client.id)
      }
    }
  }

  const allIdsToUpdate = [...exploradosIds, ...ativosAgendadosNaJanelaIds, ...ativosAgendadosForaJanelaIds]
  const allVisibleIds = [...exploradosIds, ...ativosAgendadosNaJanelaIds]

  // =========================================================================
  // PASSO 4: Atualizar vendedorId e visivelDashVendedor
  // =========================================================================
  // IMPORTANTE: Separamos em NOVOS (atualizar vendedorAlocadoEm) e EXISTENTES (preservar)

  // --- EXPLORADOS ---
  // Novos: setar vendedorId, vendedorAlocadoEm E visivelDashVendedor = true
  if (exploradosIdsNovos.length > 0) {
    await prisma.client.updateMany({
      where: { id: { in: exploradosIdsNovos } },
      data: {
        vendedorId: novoVendedorId,
        vendedorAlocadoEm: new Date(),
        visivelDashVendedor: true,
      },
    })
  }
  // Existentes: apenas garantir visivelDashVendedor = true (NÃO atualiza vendedorAlocadoEm)
  if (exploradosIdsExistentes.length > 0) {
    await prisma.client.updateMany({
      where: { id: { in: exploradosIdsExistentes } },
      data: {
        visivelDashVendedor: true,
      },
    })
  }

  // Registrar INDASH apenas para NOVOS EXPLORADOS (existentes já têm histórico)
  if (exploradosIdsNovos.length > 0) {
    const indashEntries: HistoricoEntry[] = exploradosIdsNovos.map((clientId) => ({
      clientId,
      vendedorId: novoVendedorId,
      type: "INDASH" as const,
      category: "EXPLORADO",
      reason: "[EXPLORADO] Atribuição manual de vendedor",
    }))

    await registrarHistoricoBatch(prisma as PrismaClient, indashEntries)
  }

  // --- ATIVOS/AGENDADOS NA JANELA ---
  // Novos: setar vendedorId, vendedorAlocadoEm E visivelDashVendedor = true
  if (ativosAgendadosNaJanelaIdsNovos.length > 0) {
    await prisma.client.updateMany({
      where: { id: { in: ativosAgendadosNaJanelaIdsNovos } },
      data: {
        vendedorId: novoVendedorId,
        vendedorAlocadoEm: new Date(),
        visivelDashVendedor: true,
      },
    })
  }
  // Existentes: apenas garantir visivelDashVendedor = true (NÃO atualiza vendedorAlocadoEm)
  if (ativosAgendadosNaJanelaIdsExistentes.length > 0) {
    await prisma.client.updateMany({
      where: { id: { in: ativosAgendadosNaJanelaIdsExistentes } },
      data: {
        visivelDashVendedor: true,
      },
    })
  }

  // Registrar INDASH apenas para NOVOS ATIVOS/AGENDADOS na janela
  if (ativosAgendadosNaJanelaIdsNovos.length > 0) {
    const indashEntriesNovos = ativosAgendadosNaJanelaInfo
      .filter((info) => ativosAgendadosNaJanelaIdsNovos.includes(info.id))
      .map((info) => ({
        clientId: info.id,
        vendedorId: novoVendedorId,
        type: "INDASH" as const,
        category: info.categoria,
        reason: `[${info.categoria}] Atribuição manual - cliente dentro da janela de aparição`,
      }))

    await registrarHistoricoBatch(prisma as PrismaClient, indashEntriesNovos)
  }

  // --- ATIVOS/AGENDADOS FORA DA JANELA ---
  // Novos: setar vendedorId, vendedorAlocadoEm E visivelDashVendedor = false
  if (ativosAgendadosForaJanelaIdsNovos.length > 0) {
    await prisma.client.updateMany({
      where: { id: { in: ativosAgendadosForaJanelaIdsNovos } },
      data: {
        vendedorId: novoVendedorId,
        vendedorAlocadoEm: new Date(),
        visivelDashVendedor: false,
      },
    })
    // Não registra INDASH - o cron fará isso quando o cliente entrar na janela
  }
  // Existentes: apenas garantir visivelDashVendedor = false (NÃO atualiza vendedorAlocadoEm)
  if (ativosAgendadosForaJanelaIdsExistentes.length > 0) {
    await prisma.client.updateMany({
      where: { id: { in: ativosAgendadosForaJanelaIdsExistentes } },
      data: {
        visivelDashVendedor: false,
      },
    })
  }

  // =========================================================================
  // PASSO 5: Reset do Kanban para TODOS os clientes atribuídos (BATCH)
  // =========================================================================
  if (allIdsToUpdate.length > 0) {
    // Usar uma única query com VALUES múltiplos em vez de Promise.all
    // para evitar esgotar o connection pool
    const values = allIdsToUpdate
      .map((clientId) => `(${clientId}, 0, 0, NOW(), NOW())`)
      .join(", ")

    await prisma.$executeRawUnsafe(`
      INSERT INTO "ClientKanbanEstado" ("clientId", "code", "position", "createdAt", "updatedAt")
      VALUES ${values}
      ON CONFLICT ("clientId") DO UPDATE
      SET "code" = EXCLUDED."code",
          "position" = EXCLUDED."position",
          "updatedAt" = NOW()
    `)
  }

  return {
    assigned: allIdsToUpdate.length,
    visibleInDashboard: allVisibleIds.length,
    exploradosVisibleInDashboard: exploradosIds.length,
    ativosAgendadosVisibleInDashboard: ativosAgendadosNaJanelaIds.length,
    skipped: excludeIds.length,
    skippedClients: [],
  }
}

/**
 * Libera completamente um cliente de um vendedor.
 * 
 * Comportamento:
 * - Remove vendedorId
 * - Remove vendedorAlocadoEm
 * - Seta visivelDashVendedor = false
 * - Registra histórico OUTDASH (se estava visível no dashboard)
 * 
 * Use esta função para "liberar" completamente um cliente.
 */
export async function releaseClientFromVendor(
  prisma: PrismaClient | Prisma.TransactionClient,
  clientId: number,
  reason: string = "Liberação de cliente"
): Promise<void> {
  // Buscar cliente para registrar histórico
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { vendedorId: true, categoria: true, visivelDashVendedor: true },
  })

  if (!client || !client.vendedorId) {
    return
  }

  const vendedorIdAnterior = client.vendedorId
  const estaNosDashboard = client.visivelDashVendedor

  // Atualizar cliente - liberação completa
  await prisma.client.update({
    where: { id: clientId },
    data: {
      vendedorId: null,
      vendedorAlocadoEm: null,
      visivelDashVendedor: false,
    },
  })

  // Registrar histórico APENAS se estava visível no dashboard
  if (estaNosDashboard) {
    await registrarHistoricoBatch(prisma as PrismaClient, [
      {
        clientId,
        vendedorId: vendedorIdAnterior,
        type: "OUTDASH",
        category: client.categoria ?? "EXPLORADO",
        reason: `[${client.categoria ?? "EXPLORADO"}] ${reason}`,
      },
    ])
  }

  // Limpar estado do Kanban (zerar ao sair do dashboard/vendedor)
  const kanbanRepo = createPrismaKanbanRepository(prisma)
  await clearClientKanbanStates(kanbanRepo, [clientId])
}


/**
 * Libera completamente múltiplos clientes de seus vendedores (batch).
 * 
 * Comportamento para cada cliente:
 * - Remove vendedorId
 * - Remove vendedorAlocadoEm
 * - Seta visivelDashVendedor = false
 * - Registra histórico OUTDASH (se estava visível no dashboard)
 */
export async function releaseClientsFromVendorBatch(
  prisma: PrismaClient | Prisma.TransactionClient,
  clientIds: number[],
  reason: string = "Liberação de clientes (batch)"
): Promise<number> {
  if (clientIds.length === 0) return 0

  // Buscar clientes para registrar histórico (apenas os que têm vendedor)
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds }, vendedorId: { not: null } },
    select: { id: true, vendedorId: true, categoria: true, visivelDashVendedor: true },
  })

  if (clients.length === 0) return 0

  // Atualizar clientes - liberação completa
  await prisma.client.updateMany({
    where: { id: { in: clientIds } },
    data: {
      vendedorId: null,
      vendedorAlocadoEm: null,
      visivelDashVendedor: false,
    },
  })

  // Registrar histórico APENAS para os que estavam visíveis no dashboard
  const clientsVisiveis = clients.filter((c) => c.visivelDashVendedor)

  if (clientsVisiveis.length > 0) {
    const historicoEntries: HistoricoEntry[] = clientsVisiveis.map((client) => ({
      clientId: client.id,
      vendedorId: client.vendedorId!,
      type: "OUTDASH" as const,
      category: client.categoria ?? "EXPLORADO",
      reason: `[${client.categoria ?? "EXPLORADO"}] ${reason}`,
    }))

    await registrarHistoricoBatch(prisma as PrismaClient, historicoEntries)
  }

  // Limpar estado do Kanban (zerar ao sair do dashboard/vendedor)
  const kanbanRepo = createPrismaKanbanRepository(prisma)
  await clearClientKanbanStates(kanbanRepo, clientIds)

  return clients.length
}


