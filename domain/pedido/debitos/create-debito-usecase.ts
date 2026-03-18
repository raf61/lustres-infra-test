import type { PrismaClient } from "@prisma/client"
import { createPedidoDebitosRepository } from "./create-debito-repository"

export type CreateDebitoInput = {
  pedidoId: number
  valor: number
  vencimento: Date
}

export type CreateDebitoResult = {
  debitoId: number
}

export async function createPedidoDebito(
  prisma: PrismaClient,
  input: CreateDebitoInput
): Promise<CreateDebitoResult> {
  if (!Number.isFinite(input.pedidoId) || input.pedidoId <= 0) {
    throw new Error("Pedido inválido.")
  }
  if (!Number.isFinite(input.valor) || input.valor <= 0) {
    throw new Error("Valor inválido.")
  }
  if (!(input.vencimento instanceof Date) || Number.isNaN(input.vencimento.getTime())) {
    throw new Error("Vencimento inválido.")
  }

  const repository = createPedidoDebitosRepository(prisma)
  const pedido = await repository.getPedidoBasics(input.pedidoId)
  if (!pedido) {
    throw new Error("Pedido não encontrado.")
  }

  const debito = await repository.createDebito({
    pedidoId: pedido.id,
    clienteId: pedido.clienteId,
    receber: input.valor,
    vencimento: input.vencimento,
  })

  return { debitoId: debito.id }
}
