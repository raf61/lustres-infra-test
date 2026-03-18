import type { PrismaClient } from "@prisma/client"

export type PedidoDebitoData = {
  pedidoId: number
  clienteId: number
  receber: number
  vencimento: Date
}

export interface PedidoDebitosRepository {
  getPedidoBasics(pedidoId: number): Promise<{ id: number; clienteId: number } | null>
  createDebito(data: PedidoDebitoData): Promise<{ id: number }>
}

export function createPedidoDebitosRepository(prisma: PrismaClient): PedidoDebitosRepository {
  return {
    async getPedidoBasics(pedidoId: number) {
      return prisma.pedido.findUnique({
        where: { id: pedidoId },
        select: { id: true, clienteId: true },
      })
    },

    async createDebito(data: PedidoDebitoData) {
      return prisma.debito.create({
        data: {
          pedidoId: data.pedidoId,
          clienteId: data.clienteId,
          receber: data.receber,
          vencimento: data.vencimento,
          dataOcorrencia: null,
          recebido: null,
          acrescimos: null,
          descontos: null,
          email: null,
          banCobrador: null,
          stats: 0,
          remessa: false,
          linkBoleto: null,
        },
        select: { id: true },
      })
    },
  }
}
