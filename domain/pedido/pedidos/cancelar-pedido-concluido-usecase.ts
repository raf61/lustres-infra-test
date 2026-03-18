import { PrismaClient } from "@prisma/client"
import { cancelarPedidoFinal } from "./cancelar-pedido-final-usecase"

type CancelarPedidoConcluidoInput = {
  pedidoId: number
  dataContatoAgendado?: Date | null
}

async function cancelarPedidoConcluido(
  prisma: PrismaClient,
  input: CancelarPedidoConcluidoInput
) {
  const clientUpdateData =
    input.dataContatoAgendado !== undefined ? { dataContatoAgendado: input.dataContatoAgendado ?? null } : null

  return cancelarPedidoFinal(prisma, {
    pedidoId: input.pedidoId,
    clientUpdateData,
  })
}

export async function cancelarPedidoConcluidoNormal(
  prisma: PrismaClient,
  input: CancelarPedidoConcluidoInput
) {
  return cancelarPedidoConcluido(prisma, input)
}

export async function cancelarPedidoConcluidoOs(
  prisma: PrismaClient,
  input: CancelarPedidoConcluidoInput
) {
  return cancelarPedidoConcluido(prisma, input)
}


