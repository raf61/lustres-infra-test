/**
 * Use Case para exportação ART
 * Orquestra a lógica de busca, transformação e marcação
 */

import type { PrismaClient } from "@prisma/client"
import { createExportARTRepository } from "./export-art-repository"
import { pedidoToARTRow, generateCSVContent } from "./export-art-rules"
import type { ExportARTResult } from "./export-art-types"

export interface ExportARTInput {
  pedidoIds?: number[]
}

export interface ExportARTPreviewResult {
  quantidadePedidos: number
  pedidos: {
    id: number
    createdAt: Date
    cliente: string
    cnpj: string
  }[]
}

/**
 * Obtém preview da exportação (quantos pedidos serão afetados)
 * Sem marcar como exportados
 */
export async function getExportARTPreview(
  prisma: PrismaClient
): Promise<ExportARTPreviewResult> {
  const repository = createExportARTRepository(prisma)
  const pedidos = await repository.getPedidosNaoExportados()

  return {
    quantidadePedidos: pedidos.length,
    pedidos: pedidos.map(p => ({
      id: p.id,
      createdAt: p.createdAt,
      cliente: p.cliente.razaoSocial || "Sem Razão Social",
      cnpj: p.cliente.cnpj || ""
    })),
  }
}

/**
 * Executa a exportação ART:
 * 1. Busca pedidos CONCLUÍDOS não exportados até a data limite
 * 2. Em transação: marca todos como exportados
 * 3. Gera e retorna o CSV
 */
export async function executeExportART(
  prisma: PrismaClient,
  input: ExportARTInput
): Promise<ExportARTResult> {
  // Executa tudo em uma transação para garantir atomicidade
  const result = await prisma.$transaction(async (tx) => {
    const repository = createExportARTRepository(tx as PrismaClient)

    if (!input.pedidoIds || input.pedidoIds.length === 0) {
      return {
        pedidosAtualizados: 0,
        csvContent: "",
      }
    }

    // 1. Buscar pedidos selecionados
    const pedidos = await repository.getPedidosByIds(input.pedidoIds)

    if (pedidos.length === 0) {
      return {
        pedidosAtualizados: 0,
        csvContent: "",
      }
    }

    // 2. Marcar como exportados
    const pedidoIds = pedidos.map(p => p.id)
    await repository.marcarComoExportados(pedidoIds)

    // 3. Gerar CSV (Desabilitado)
    // const rows = pedidos.map(pedidoToARTRow)
    // const csvContent = generateCSVContent(rows)

    return {
      pedidosAtualizados: pedidos.length,
      csvContent: "", // Não gera mais CSV
    }
  })

  return result
}

