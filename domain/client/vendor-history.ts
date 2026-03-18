/**
 * Módulo centralizado para gerenciamento do histórico do dashboard do vendedor.
 * 
 * Este módulo é responsável por:
 * - Registrar eventos de entrada/saída no dashboard do vendedor
 * - Manter histórico auditável de todas as operações
 * 
 * Tipos de eventos:
 * - INDASH: Cliente entrou no dashboard do vendedor
 * - OUTDASH: Cliente saiu do dashboard do vendedor
 */

import { PrismaClient, Prisma } from "@prisma/client"

// Tipos de eventos do histórico
export type HistoricoEventType = "INDASH" | "OUTDASH"

// Categorias de clientes
export type ClientCategory = "ATIVO" | "AGENDADO" | "EXPLORADO" | string

export interface HistoricoEntry {
  clientId: number
  vendedorId: string
  type: HistoricoEventType
  category: ClientCategory  // Categoria do cliente no momento do evento
  reason: string
}

/**
 * Registra um único evento no histórico do cliente
 */
export async function registrarHistorico(
  prisma: PrismaClient | Prisma.TransactionClient,
  entry: HistoricoEntry
): Promise<void> {
  await prisma.historicoClient.create({
    data: {
      clientId: entry.clientId,
      vendedorId: entry.vendedorId,
      type: entry.type,
      category: entry.category,
      reason: entry.reason,
    },
  })
}

/**
 * Registra múltiplos eventos no histórico em batch
 * Usado para operações em massa (ex: cron job mensal)
 */
export async function registrarHistoricoBatch(
  prisma: PrismaClient | Prisma.TransactionClient,
  entries: HistoricoEntry[]
): Promise<void> {
  if (entries.length === 0) return

  await prisma.historicoClient.createMany({
    data: entries.map((entry) => ({
      clientId: entry.clientId,
      vendedorId: entry.vendedorId,
      type: entry.type,
      category: entry.category,
      reason: entry.reason,
    })),
  })
}

/**
 * Busca o histórico de um cliente específico
 */
export async function getHistoricoByClientId(
  prisma: PrismaClient | Prisma.TransactionClient,
  clientId: number
): Promise<Array<{
  id: number
  clientId: number
  vendedorId: string
  type: string
  category: string | null
  reason: string | null
  createdAt: Date
}>> {
  return prisma.historicoClient.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Busca o histórico de um vendedor específico
 */
export async function getHistoricoByVendedorId(
  prisma: PrismaClient | Prisma.TransactionClient,
  vendedorId: string
): Promise<Array<{
  id: number
  clientId: number
  vendedorId: string
  type: string
  category: string | null
  reason: string | null
  createdAt: Date
}>> {
  return prisma.historicoClient.findMany({
    where: { vendedorId },
    orderBy: { createdAt: "desc" },
  })
}

