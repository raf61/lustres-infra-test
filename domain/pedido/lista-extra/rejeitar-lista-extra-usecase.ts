import { ListaExtraStatus, PedidoStatus, PrismaClient } from "@prisma/client"

type RejeitarListaExtraInput = {
  listaId: number
}

async function rejeitarListaExtra(
  prisma: PrismaClient,
  input: RejeitarListaExtraInput
) {
  const lista = await prisma.listaExtra.findUnique({
    where: { id: input.listaId },
    include: {
      visita: { select: { id: true, pedidoId: true } },
    },
  })

  if (!lista) {
    throw new Error("Lista extra não encontrada.")
  }

  if (lista.status !== ListaExtraStatus.PENDENTE) {
    throw new Error("Apenas listas pendentes podem ser rejeitadas.")
  }

  if (!lista.visita?.pedidoId) {
    throw new Error("Lista extra não está vinculada a um pedido.")
  }

  const pedidoId = lista.visita.pedidoId

  await prisma.$transaction(async (tx) => {
    await tx.listaExtra.update({
      where: { id: input.listaId },
      data: { status: ListaExtraStatus.REJEITADO },
    })

    const pendingCount = await tx.listaExtra.count({
      where: {
        status: ListaExtraStatus.PENDENTE,
        visita: { pedidoId },
      },
    })

    if (pendingCount === 0) {
      await tx.pedido.update({
        where: { id: pedidoId },
        data: { status: PedidoStatus.AGUARDANDO_APROVACAO_SUPERVISAO },
      })
    }
  })
}

export async function rejeitarListaExtraNormal(
  prisma: PrismaClient,
  input: RejeitarListaExtraInput
) {
  await rejeitarListaExtra(prisma, input)
}

