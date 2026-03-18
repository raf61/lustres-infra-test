import type { PrismaClient } from "@prisma/client"
import { cancelarPedidoFinal } from "./cancelar-pedido-final-usecase"

type CancelarPedidoImediatoInput = {
  pedidoId: number
}

export async function cancelarPedidoImediato(prisma: PrismaClient, input: CancelarPedidoImediatoInput) {
  return cancelarPedidoFinal(prisma, { pedidoId: input.pedidoId })
}
