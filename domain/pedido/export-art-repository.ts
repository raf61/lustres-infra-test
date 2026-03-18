/**
 * Repository para exportação ART
 * Adapta o use case ao Prisma
 */

import type { PrismaClient } from "@prisma/client"
import type { PedidoParaART } from "./export-art-types"

export interface ExportARTRepository {
  /**
   * Busca pedidos CONCLUÍDOS que ainda não foram exportados para ART
   */
  getPedidosNaoExportados(): Promise<PedidoParaART[]>

  /**
   * Marca pedidos como exportados para ART (em transação)
   * Retorna a quantidade de pedidos atualizados
   */
  marcarComoExportados(pedidoIds: number[]): Promise<number>

  /**
   * Busca pedidos específicos para exportação
   */
  getPedidosByIds(ids: number[]): Promise<PedidoParaART[]>
}

/**
 * Factory para criar o repository com Prisma
 */
export function createExportARTRepository(prisma: PrismaClient): ExportARTRepository {
  return {
    async getPedidosNaoExportados(): Promise<PedidoParaART[]> {
      const pedidos = await prisma.pedido.findMany({
        where: {
          geradoART: false,
          status: "CONCLUIDO",
        },
        select: {
          id: true,
          createdAt: true,
          cliente: {
            select: {
              id: true,
              razaoSocial: true,
              cnpj: true,
              cep: true,
              logradouro: true,
              numero: true,
              complemento: true,
              bairro: true,
              cidade: true,
              estado: true,
              quantidadeAndares: true,
              especificacaoCondominio: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      })

      return pedidos
    },

    async marcarComoExportados(pedidoIds: number[]): Promise<number> {
      if (pedidoIds.length === 0) return 0

      const result = await prisma.pedido.updateMany({
        where: {
          id: { in: pedidoIds },
        },
        data: {
          geradoART: true,
        },
      })

      return result.count
    },

    async getPedidosByIds(ids: number[]): Promise<PedidoParaART[]> {
      return prisma.pedido.findMany({
        where: {
          id: { in: ids },
          geradoART: false,
          status: "CONCLUIDO",
        },
        select: {
          id: true,
          createdAt: true,
          cliente: {
            select: {
              id: true,
              razaoSocial: true,
              cnpj: true,
              cep: true,
              logradouro: true,
              numero: true,
              complemento: true,
              bairro: true,
              cidade: true,
              estado: true,
              quantidadeAndares: true,
              especificacaoCondominio: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      })
    },
  }
}

