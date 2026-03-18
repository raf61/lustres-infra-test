/**
 * Use case para atualizar status de ART do pedido
 * Centraliza regra: null -> false (solicita geração)
 */

import type { PrismaClient } from "@prisma/client"

export interface RequestArtGenerationInput {
  pedidoId: number
}

export interface RequestArtGenerationResult {
  geradoART: boolean | null
}

export async function requestArtGeneration(
  prisma: PrismaClient,
  input: RequestArtGenerationInput
): Promise<RequestArtGenerationResult> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: input.pedidoId },
    select: { id: true, geradoART: true },
  })

  if (!pedido) {
    throw new Error("Pedido não encontrado.")
  }

  if (pedido.geradoART !== null) {
    throw new Error("ART já definida para este pedido.")
  }

  const updated = await prisma.pedido.update({
    where: { id: input.pedidoId },
    data: { geradoART: false },
    select: { geradoART: true },
  })

  return { geradoART: updated.geradoART }
}

