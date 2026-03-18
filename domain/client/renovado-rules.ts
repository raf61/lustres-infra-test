/**
 * Regras para identificação de clientes RENOVADOS.
 * 
 * Um cliente é considerado RENOVADO quando:
 * - Categoria = ATIVO
 * - ultimaManutencao está nos últimos X meses (configurável)
 * 
 * Clientes renovados já foram atendidos recentemente e não precisam
 * estar visíveis no dashboard do vendedor.
 * 
 * Este módulo contém apenas as REGRAS de identificação.
 * A ação de remover do dashboard é delegada para vendor-dashboard-rules.
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import { makeClientsNotVisibleInDashboardBatch } from "./vendor-dashboard-rules"

import { MESES_RENOVADO } from "../../lib/client-status"

// ============================================================================
// TIPOS
// ============================================================================

export interface ClienteRenovadoInfo {
  id: number
  vendedorId: string
  categoria: string
  ultimaManutencao: Date
}

export interface RemoverRenovadosResult {
  processados: number
  removidos: number
}

// ============================================================================
// FUNÇÕES DE IDENTIFICAÇÃO
// ============================================================================

/**
 * Verifica se uma data de ultimaManutencao caracteriza um cliente como renovado.
 * Retorna true se a ultimaManutencao está nos últimos MESES_RENOVADO meses.
 */
export function isRenovado(ultimaManutencao: Date | null, dataReferencia: Date = new Date()): boolean {
  if (!ultimaManutencao) return false
  const limiteRenovado = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), 1)
  limiteRenovado.setMonth(limiteRenovado.getMonth() - MESES_RENOVADO)
  return ultimaManutencao >= limiteRenovado
}

/**
 * Busca todos os clientes ATIVOS renovados que estão visíveis no dashboard.
 * Esses clientes devem ser removidos do dashboard pois já foram atendidos,
 * exceto quando há contato agendado recente (>= hoje - 3 dias).
 */
export async function buscarRenovadosVisiveis(
  prisma: PrismaClient | Prisma.TransactionClient,
  dataReferencia: Date = new Date()
): Promise<ClienteRenovadoInfo[]> {
  const limiteRenovado = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), 1)
  limiteRenovado.setMonth(limiteRenovado.getMonth() - MESES_RENOVADO)
  const limiteContatoAgendado = new Date(dataReferencia)
  limiteContatoAgendado.setDate(limiteContatoAgendado.getDate() - 3)

  const renovados = await prisma.client.findMany({
    where: {
      categoria: "ATIVO",
      vendedorId: { not: null },
      visivelDashVendedor: true,
      // Se tiver contato agendado recente, mantém no dashboard
      OR: [
        { dataContatoAgendado: null },
        { dataContatoAgendado: { lte: limiteContatoAgendado } },
      ],
      ultimaManutencao: {
        gte: limiteRenovado, // ultimaManutencao >= (hoje - 2 meses) = renovado
      },
    },
    select: {
      id: true,
      vendedorId: true,
      categoria: true,
      ultimaManutencao: true,
    },
  })
  return renovados.map((c) => ({
    id: c.id,
    vendedorId: c.vendedorId!,
    categoria: c.categoria ?? "ATIVO",
    ultimaManutencao: c.ultimaManutencao!,
  }))
}

// ============================================================================
// AÇÕES
// ============================================================================

/**
 * Remove clientes renovados do dashboard (mantém vendedorId).
 * 
 * Delega a ação para makeClientsNotVisibleInDashboardBatch.
 * 
 * @param prisma - Cliente Prisma
 * @param dataReferencia - Data de referência para calcular renovados
 * @returns Resultado da operação
 */
export async function removerRenovadosDoDashboard(
  prisma: PrismaClient | Prisma.TransactionClient,
  dataReferencia: Date = new Date()
): Promise<RemoverRenovadosResult> {
  // Buscar renovados visíveis
  const renovados = await buscarRenovadosVisiveis(prisma, dataReferencia)
  if (renovados.length === 0) {
    return { processados: 0, removidos: 0 }
  }
  const clientIds = renovados.map((c) => c.id)
  // Usar a função centralizada para remover do dashboard
  const removidos = await makeClientsNotVisibleInDashboardBatch(
    prisma,
    clientIds,
    `Cliente renovado removido do dashboard (ultimaManutencao < ${MESES_RENOVADO} meses)`
  )
  return {
    processados: renovados.length,
    removidos,
  }
}
