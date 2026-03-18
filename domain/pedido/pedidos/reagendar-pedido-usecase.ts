import { PedidoStatus, PrismaClient, VisitaTecnicaStatus } from "@prisma/client"

type ReagendarPedidoInput = {
  pedidoId: number
}

async function reagendarPedido(prisma: PrismaClient, input: ReagendarPedidoInput) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: input.pedidoId },
    select: { id: true },
  })

  if (!pedido) {
    throw new Error("Pedido não encontrado.")
  }

  const visitaNaoAutorizada = await prisma.visitaTecnica.findFirst({
    where: { pedidoId: input.pedidoId, status: VisitaTecnicaStatus.ANALISE_NAO_AUTORIZADO },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  })

  await prisma.$transaction([
    prisma.pedido.update({
      where: { id: input.pedidoId },
      data: { status: PedidoStatus.AGUARDANDO },
    }),
    ...(visitaNaoAutorizada
      ? [
          prisma.visitaTecnica.update({
            where: { id: visitaNaoAutorizada.id },
            data: { status: VisitaTecnicaStatus.CANCELADO },
          }),
        ]
      : []),
  ])
}

export async function reagendarPedidoNormal(prisma: PrismaClient, input: ReagendarPedidoInput) {
  await reagendarPedido(prisma, input)
}

export async function reagendarPedidoOs(prisma: PrismaClient, input: ReagendarPedidoInput) {
  await reagendarPedido(prisma, input)
}

