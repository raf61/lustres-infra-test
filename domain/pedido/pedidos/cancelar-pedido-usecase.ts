import { PedidoStatus, PrismaClient, VisitaTecnicaStatus } from "@prisma/client"

type CancelarPedidoInput = {
  pedidoId: number
  motivo?: string | null
  ultimaManutencao?: Date | null
}

async function cancelarPedido(
  prisma: PrismaClient,
  input: CancelarPedidoInput
): Promise<{ alreadyCancelled: boolean }> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: input.pedidoId },
    select: { id: true, status: true, clienteId: true, orcamentoId: true, motivoCancelamento: true },
  })

  if (!pedido) {
    throw new Error("Pedido não encontrado.")
  }

  if (pedido.status === PedidoStatus.CANCELADO) {
    return { alreadyCancelled: true }
  }

  const visitaNaoAutorizada = await prisma.visitaTecnica.findFirst({
    where: { pedidoId: input.pedidoId, status: VisitaTecnicaStatus.ANALISE_NAO_AUTORIZADO },
    orderBy: { updatedAt: "desc" },
    select: { id: true, motivo_nao_autorizado: true },
  })

  const motivoCombinado = [pedido.motivoCancelamento, visitaNaoAutorizada?.motivo_nao_autorizado, input.motivo]
    .filter(Boolean)
    .join(" | ")

  await prisma.$transaction(async (tx) => {
    await tx.pedido.update({
      where: { id: input.pedidoId },
      data: {
        status: PedidoStatus.ANALISE_CANCELAMENTO,
        motivoCancelamento: motivoCombinado || null,
      },
    })

    if (visitaNaoAutorizada) {
      await tx.visitaTecnica.update({
        where: { id: visitaNaoAutorizada.id },
        data: { status: VisitaTecnicaStatus.CANCELADO },
      })
    }

    if (pedido.clienteId && input.ultimaManutencao !== undefined) {
      await tx.client.update({
        where: { id: pedido.clienteId },
        data: { ultimaManutencao: input.ultimaManutencao ?? null },
      })
    }

  })

  return { alreadyCancelled: false }
}

export async function cancelarPedidoNormal(prisma: PrismaClient, input: CancelarPedidoInput) {
  return cancelarPedido(prisma, input)
}

export async function cancelarPedidoOs(prisma: PrismaClient, input: CancelarPedidoInput) {
  return cancelarPedido(prisma, input)
}

