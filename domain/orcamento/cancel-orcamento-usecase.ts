import { OrcamentoStatus, type PrismaClient } from "@prisma/client"
import { createCancelOrcamentoRepository } from "./cancel-orcamento-repository"

export type CancelOrcamentoInput = {
  orcamentoId: number
}

export type CancelOrcamentoResult = {
  alreadyCancelled: boolean
}

export async function cancelOrcamento(
  prisma: PrismaClient,
  input: CancelOrcamentoInput
): Promise<CancelOrcamentoResult> {
  if (!Number.isFinite(input.orcamentoId) || input.orcamentoId <= 0) {
    throw new Error("Orçamento inválido.")
  }

  const repository = createCancelOrcamentoRepository(prisma)
  const orcamento = await repository.getStatus(input.orcamentoId)
  if (!orcamento) {
    throw new Error("Orçamento não encontrado.")
  }

  if (orcamento.status === OrcamentoStatus.APROVADO) {
    throw new Error("Orçamento aprovado não pode ser cancelado.")
  }

  if (orcamento.status === OrcamentoStatus.CANCELADO) {
    return { alreadyCancelled: true }
  }

  await repository.cancel(input.orcamentoId)

  return { alreadyCancelled: false }
}
