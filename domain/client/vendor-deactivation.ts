/**
 * Módulo centralizado para limpeza de dados quando um vendedor é desativado.
 * 
 * Este módulo é responsável por:
 * 1. Remover vendedorId de todos os clientes atribuídos ao vendedor
 * 2. Fechar (registrar OUTDASH) todos os HistoricoClient abertos com ele
 * 
 * Casos de uso:
 * - Inativação de usuário vendedor (API /usuarios/[id])
 * - Medida cautelar antes da atribuição mensal automática
 * 
 * Arquitetura: 
 * - Usa makeClientsNotVisibleInDashboardBatch para registrar OUTDASH (reutiliza lógica existente)
 * - Apenas adiciona a lógica específica de limpar vendedorId/vendedorAlocadoEm
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import { makeClientsNotVisibleInDashboardBatch } from "./vendor-dashboard-rules"

// ============================================================================
// TIPOS
// ============================================================================

export interface VendorDeactivationResult {
  vendedorId: string
  clientesLiberados: number
  historicosFechados: number
}

export interface AllInactiveVendorsCleanupResult {
  vendedoresProcessados: number
  totalClientesLiberados: number
  totalHistoricosFechados: number
  detalhes: VendorDeactivationResult[]
}

// ============================================================================
// FUNÇÃO PRINCIPAL - Limpar dados de um vendedor específico
// ============================================================================

/**
 * Limpa todos os dados de atribuição de um vendedor específico.
 * 
 * Operações:
 * 1. Busca todos os clientes atribuídos ao vendedor
 * 2. Usa makeClientsNotVisibleInDashboardBatch para registrar OUTDASH (reutiliza lógica)
 * 3. Remove vendedorId e vendedorAlocadoEm de todos os clientes
 * 
 * @param prisma - Cliente Prisma (pode ser transação)
 * @param vendedorId - ID do vendedor a ser limpo
 * @param reason - Motivo do cleanup (para registro no histórico)
 */
export async function cleanupVendorAssignments(
  prisma: PrismaClient | Prisma.TransactionClient,
  vendedorId: string,
  reason: string = "Vendedor desativado"
): Promise<VendorDeactivationResult> {
  // Buscar clientes atribuídos a este vendedor
  const clientes = await prisma.client.findMany({
    where: { vendedorId },
    select: { id: true },
  })

  if (clientes.length === 0) {
    return {
      vendedorId,
      clientesLiberados: 0,
      historicosFechados: 0,
    }
  }

  const clientIds = clientes.map((c) => c.id)

  // 1. Registrar OUTDASH para os visíveis (reutiliza lógica existente)
  const historicosFechados = await makeClientsNotVisibleInDashboardBatch(
    prisma,
    clientIds,
    reason
  )

  // 2. Limpar vendedorId e vendedorAlocadoEm de TODOS os clientes
  await prisma.client.updateMany({
    where: { id: { in: clientIds } },
    data: {
      vendedorId: null,
      vendedorAlocadoEm: null,
    },
  })

  return {
    vendedorId,
    clientesLiberados: clientes.length,
    historicosFechados,
  }
}

// ============================================================================
// FUNÇÃO AUXILIAR - Limpar dados de TODOS os vendedores inativos (BULK)
// ============================================================================

/**
 * Limpa atribuições de TODOS os vendedores inativos em operações BULK.
 * 
 * Usado como medida cautelar antes da atribuição mensal automática.
 * Garante que nenhum cliente fique atribuído a um vendedor inativo.
 * 
 * OTIMIZAÇÃO: Faz apenas 4 queries independente do número de vendedores:
 * 1. Buscar vendedores inativos
 * 2. Buscar TODOS os clientes desses vendedores
 * 3. makeClientsNotVisibleInDashboardBatch (registra OUTDASH + seta visivelDashVendedor=false)
 * 4. Update para limpar vendedorId e vendedorAlocadoEm
 * 
 * @param prisma - Cliente Prisma
 */
export async function cleanupAllInactiveVendorsAssignments(
  prisma: PrismaClient | Prisma.TransactionClient
): Promise<AllInactiveVendorsCleanupResult> {
  // 1. Buscar todos os vendedores inativos
  const vendedoresInativos = await prisma.user.findMany({
    where: {
      role: "VENDEDOR",
      active: false,
    },
    select: { id: true },
  })

  if (vendedoresInativos.length === 0) {
    return {
      vendedoresProcessados: 0,
      totalClientesLiberados: 0,
      totalHistoricosFechados: 0,
      detalhes: [],
    }
  }

  const vendedorIds = vendedoresInativos.map((v) => v.id)

  // 2. Buscar TODOS os clientes de TODOS os vendedores inativos
  const todosClientes = await prisma.client.findMany({
    where: { vendedorId: { in: vendedorIds } },
    select: {
      id: true,
      vendedorId: true,
    },
  })

  if (todosClientes.length === 0) {
    return {
      vendedoresProcessados: vendedoresInativos.length,
      totalClientesLiberados: 0,
      totalHistoricosFechados: 0,
      detalhes: vendedorIds.map((id) => ({
        vendedorId: id,
        clientesLiberados: 0,
        historicosFechados: 0,
      })),
    }
  }

  // Agrupar por vendedor para gerar detalhes
  const clientesPorVendedor = new Map<string, number>()
  for (const cliente of todosClientes) {
    const count = clientesPorVendedor.get(cliente.vendedorId!) ?? 0
    clientesPorVendedor.set(cliente.vendedorId!, count + 1)
  }

  const clientIds = todosClientes.map((c) => c.id)

  // 3. Registrar OUTDASH e setar visivelDashVendedor=false (reutiliza lógica existente)
  const totalHistoricosFechados = await makeClientsNotVisibleInDashboardBatch(
    prisma,
    clientIds,
    "Limpeza cautelar - vendedor inativo"
  )

  // 4. Limpar vendedorId e vendedorAlocadoEm de TODOS
  await prisma.client.updateMany({
    where: { id: { in: clientIds } },
    data: {
      vendedorId: null,
      vendedorAlocadoEm: null,
    },
  })

  // Gerar detalhes por vendedor
  const detalhes: VendorDeactivationResult[] = vendedorIds.map((vendedorId) => ({
    vendedorId,
    clientesLiberados: clientesPorVendedor.get(vendedorId) ?? 0,
    historicosFechados: 0, // Não temos essa granularidade no bulk, mas é para detalhes apenas
  }))

  return {
    vendedoresProcessados: vendedoresInativos.length,
    totalClientesLiberados: todosClientes.length,
    totalHistoricosFechados,
    detalhes,
  }
}

