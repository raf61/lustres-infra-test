/**
 * Regras do Dashboard do Vendedor.
 * 
 * Este módulo centraliza TODAS as regras de quando um cliente deve aparecer
 * ou desaparecer do dashboard do vendedor.
 * 
 * Se você precisar mudar os critérios, altere apenas aqui.
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import type { ClientCategoria } from "./category-rules"
import { registrarHistorico, registrarHistoricoBatch, type HistoricoEntry } from "./vendor-history"
import {
  createPrismaKanbanRepository,
  clearClientKanbanStates,
  updateClientKanbanState,
  bulkUpdateClientKanbanState
} from "./kanban-state-usecase"

// ============================================================================
// CONFIGURAÇÃO - Modifique estes valores para alterar os critérios
// ============================================================================

/**
 * Meses de antecedência para ATIVOS aparecerem no dashboard.
 * O cliente aparece X meses antes do vencimento (12 meses após última manutenção conosco).
 */
export const MESES_ANTECEDENCIA_ATIVOS = 2

/**
 * Meses de antecedência para AGENDADOS (livres com data) aparecerem no dashboard.
 * O cliente aparece X meses antes do vencimento da ultimaManutencao (com concorrente).
 * NOTA: Mesma antecedência dos ATIVOS para uniformidade.
 */
export const MESES_ANTECEDENCIA_AGENDADOS = 2

/**
 * Total de meses que o ATIVO tem para ser trabalhado após aparecer no dashboard.
 * (MESES_ANTECEDENCIA + mês do vencimento)
 */
export const MESES_TOTAL_TRABALHO_ATIVO = MESES_ANTECEDENCIA_ATIVOS + 1 // 2 meses antes + mês do vencimento = 3 meses

// ============================================================================
// TIPOS
// ============================================================================

export type ClientForDashboardCheck = {
  id: number
  vendedorId: string | null
  categoria: ClientCategoria | null
  ultimaManutencao: Date | null
  visivelDashVendedor: boolean
}

export type MakeVisibleInput = {
  clientId: number
  vendedorId: string
  category: ClientCategoria
  reason: string
}

// ============================================================================
// REGRAS DE VISIBILIDADE
// ============================================================================

/**
 * Calcula o MÊS de vencimento de um cliente.
 * 
 * Vencimento = mesmo mês do próximo ano (12 meses depois).
 * Trabalhamos com MESES, não datas específicas.
 * 
 * Exemplo:
 * - ultimaManutencao = 15 de Janeiro 2025
 * - Mês de vencimento = Janeiro 2026 (retorna 1 de Janeiro 2026)
 * 
 * @returns Primeiro dia do mês de vencimento
 */
export function calcularMesVencimento(ultimaManutencaoOuPedido: Date): Date {
  const base = new Date(ultimaManutencaoOuPedido)
  const vencimento = new Date(base.getFullYear() + 1, base.getMonth(), 1)
  vencimento.setHours(0, 0, 0, 0)
  return vencimento
}

/**
 * Calcula o MÊS de aparição no dashboard.
 * 
 * Aparição = X meses antes do mês de vencimento.
 * 
 * Exemplo com MESES_ANTECEDENCIA = 2:
 * - Mês de vencimento = Fevereiro 2026
 * - Mês de aparição = Dezembro 2025 (2 meses antes)
 * - Total de trabalho = Dez + Jan + Fev = 3 meses inteiros
 * 
 * @returns Primeiro dia do mês de aparição
 */
export function calcularMesAparicao(mesVencimento: Date, mesesAntecedencia: number): Date {
  const aparicao = new Date(mesVencimento)
  aparicao.setMonth(aparicao.getMonth() - mesesAntecedencia)
  aparicao.setDate(1)
  aparicao.setHours(0, 0, 0, 0)
  return aparicao
}

/**
 * Determina se um cliente ATIVO deve aparecer no dashboard.
 * 
 * Regra: Aparece a partir do início do mês que é X meses antes do mês de vencimento.
 * 
 * Exemplo:
 * - ultimoPedido = Janeiro 2025
 * - Vencimento = Fevereiro 2026
 * - Aparição = Dezembro 2025 (se MESES_ANTECEDENCIA = 2)
 * - Cliente aparece no dashboard a partir de 1 de Dezembro 2025
 */
export function deveAparecerAtivoDashboard(ultimoPedidoData: Date, now: Date = new Date()): boolean {
  const mesVencimento = calcularMesVencimento(ultimoPedidoData)
  const mesAparicao = calcularMesAparicao(mesVencimento, MESES_ANTECEDENCIA_ATIVOS)

  return now >= mesAparicao
}

/**
 * Determina se um cliente AGENDADO deve aparecer no dashboard.
 * 
 * Regra: Aparece a partir do início do mês que é X meses antes do mês de vencimento.
 * Mesma lógica dos ATIVOS, mas usando ultimaManutencao (data com concorrente).
 */
export function deveAparecerAgendadoDashboard(ultimaManutencao: Date, now: Date = new Date()): boolean {
  const mesVencimento = calcularMesVencimento(ultimaManutencao)
  const mesAparicao = calcularMesAparicao(mesVencimento, MESES_ANTECEDENCIA_AGENDADOS)

  return now >= mesAparicao
}

// Mantendo funções antigas para compatibilidade (deprecated)
/** @deprecated Use calcularMesVencimento */
export function calcularDataVencimentoAtivo(ultimoPedidoData: Date): Date {
  return calcularMesVencimento(ultimoPedidoData)
}

/** @deprecated Use calcularMesVencimento */
export function calcularDataVencimentoAgendado(ultimaManutencao: Date): Date {
  return calcularMesVencimento(ultimaManutencao)
}

// ============================================================================
// AÇÕES CENTRALIZADAS
// ============================================================================

/**
 * Torna um cliente visível no dashboard do vendedor.
 * Esta é a ÚNICA função que deve ser usada para tornar um cliente visível.
 * 
 * @param prisma - Cliente Prisma (pode ser transação)
 * @param input - Dados para tornar visível
 */
export async function makeClientVisibleInDashboard(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: MakeVisibleInput
): Promise<void> {
  const { clientId, vendedorId, category, reason } = input

  // Buscar cliente atual para verificar se tem vendedor
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { vendedorId: true },
  })

  // Só processa se o cliente tem vendedor
  if (!client?.vendedorId) {
    return
  }

  // Atualizar cliente
  await prisma.client.update({
    where: { id: clientId },
    data: { visivelDashVendedor: true },
  })

  // Registrar no histórico (tabela HistoricoClient)
  await registrarHistorico(prisma as PrismaClient, {
    clientId,
    vendedorId,
    type: "INDASH",
    category,
    reason: `[${category}] ${reason}`,
  })

  // Reset do Kanban ao entrar no dashboard (INDASH)
  const kanbanRepo = createPrismaKanbanRepository(prisma)
  await updateClientKanbanState(kanbanRepo, clientId, 0)
}

/**
 * Torna múltiplos clientes visíveis no dashboard do vendedor (batch).
 * Esta é a versão otimizada para processar muitos clientes.
 * 
 * @param prisma - Cliente Prisma
 * @param clientIds - IDs dos clientes
 * @param vendedorId - ID do vendedor
 * @param category - Categoria dos clientes
 * @param reason - Motivo da visibilidade
 */
export async function makeClientsVisibleInDashboardBatch(
  prisma: PrismaClient | Prisma.TransactionClient,
  clientIds: number[],
  vendedorId: string,
  category: ClientCategoria,
  reason: string
): Promise<number> {
  if (clientIds.length === 0) {
    return 0
  }

  // Atualização em batch do visivelDashVendedor
  const result = await prisma.$executeRaw`
    UPDATE "Client"
    SET "visivelDashVendedor" = true
    WHERE "id" = ANY(${clientIds}::int[])
    AND "vendedorId" IS NOT NULL
  `

  // Registrar no histórico (batch)
  const entries: HistoricoEntry[] = clientIds.map((clientId) => ({
    clientId,
    vendedorId,
    type: "INDASH" as const,
    category,
    reason: `[${category}] ${reason}`,
  }))

  await registrarHistoricoBatch(prisma as PrismaClient, entries)

  // Reset do Kanban ao entrar no dashboard (INDASH)
  const kanbanRepo = createPrismaKanbanRepository(prisma)
  await bulkUpdateClientKanbanState(kanbanRepo, clientIds, 0)

  return result
}

/**
 * Torna um cliente NÃO visível no dashboard do vendedor.
 * Mantém o vendedorId - apenas remove do dashboard.
 * 
 * @param prisma - Cliente Prisma
 * @param clientId - ID do cliente
 * @param reason - Motivo da remoção
 */
export async function makeClientNotVisibleInDashboard(
  prisma: PrismaClient | Prisma.TransactionClient,
  clientId: number,
  reason: string
): Promise<void> {
  // Buscar cliente atual
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      vendedorId: true,
      categoria: true,
    },
  })

  if (!client) {
    return
  }

  // Atualizar cliente
  await prisma.client.update({
    where: { id: clientId },
    data: { visivelDashVendedor: false },
  })

  // Registrar no histórico
  if (client.vendedorId) {
    await registrarHistorico(prisma as PrismaClient, {
      clientId,
      vendedorId: client.vendedorId,
      type: "OUTDASH",
      category: client.categoria ?? "EXPLORADO",
      reason: `[${client.categoria ?? "EXPLORADO"}] ${reason}`,
    })
  }

  // Limpar estado do Kanban (zerar ao sair)
  const kanbanRepo = createPrismaKanbanRepository(prisma)
  await clearClientKanbanStates(kanbanRepo, [clientId])
}

/**
 * Torna múltiplos clientes NÃO visíveis no dashboard do vendedor (batch).
 * Mantém o vendedorId - apenas remove do dashboard.
 * 
 * @param prisma - Cliente Prisma
 * @param clientIds - IDs dos clientes
 * @param reason - Motivo da remoção
 * @returns Quantidade de clientes removidos do dashboard
 */
export async function makeClientsNotVisibleInDashboardBatch(
  prisma: PrismaClient | Prisma.TransactionClient,
  clientIds: number[],
  reason: string
): Promise<number> {
  if (clientIds.length === 0) return 0

  // Buscar clientes que estão visíveis no dashboard
  const clients = await prisma.client.findMany({
    where: {
      id: { in: clientIds },
      visivelDashVendedor: true,
      vendedorId: { not: null },
    },
    select: {
      id: true,
      vendedorId: true,
      categoria: true,
    },
  })

  if (clients.length === 0) return 0

  const idsToUpdate = clients.map((c) => c.id)

  // Atualizar visivelDashVendedor = false
  await prisma.client.updateMany({
    where: { id: { in: idsToUpdate } },
    data: { visivelDashVendedor: false },
  })

  // Registrar OUTDASH no histórico
  const outdashEntries: HistoricoEntry[] = clients.map((client) => ({
    clientId: client.id,
    vendedorId: client.vendedorId!,
    type: "OUTDASH" as const,
    category: client.categoria ?? "EXPLORADO",
    reason: `[${client.categoria ?? "EXPLORADO"}] ${reason}`,
  }))

  await registrarHistoricoBatch(prisma as PrismaClient, outdashEntries)

  // Limpar estado do Kanban (zerar ao sair)
  const kanbanRepo = createPrismaKanbanRepository(prisma)
  await clearClientKanbanStates(kanbanRepo, idsToUpdate)

  return clients.length
}

/**
 * Garante que clientes sem vendedor não são visíveis no dashboard.
 * Deve ser chamada quando um cliente perde seu vendedor.
 */
export async function ensureNoVendorNotVisible(
  prisma: PrismaClient | Prisma.TransactionClient,
  clientId: number
): Promise<void> {
  await prisma.client.update({
    where: { id: clientId },
    data: { visivelDashVendedor: false },
  })
}

// ============================================================================
// NOTA: Para REMOVER COMPLETAMENTE um cliente do vendedor, use:
// releaseClientFromVendor() ou releaseClientsFromVendorBatch()
// de "@/domain/client/vendor-assignment-rules"
// 
// Essas funções fazem:
// - visivelDashVendedor = false
// - vendedorId = null
// - vendedorAlocadoEm = null
// - Registra OUTDASH no histórico
// ============================================================================
