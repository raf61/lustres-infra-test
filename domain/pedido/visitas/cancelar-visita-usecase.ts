import { PedidoStatus, PrismaClient, VisitaTecnicaStatus } from "@prisma/client"

type CancelarVisitaInput = {
  visitaId: number
}

async function cancelarVisita(prisma: PrismaClient, input: CancelarVisitaInput) {
  const visita = await prisma.visitaTecnica.findUnique({
    where: { id: input.visitaId },
    select: { id: true, status: true, pedidoId: true },
  })

  if (!visita) {
    throw new Error("Visita técnica não encontrada.")
  }

  if (visita.status === VisitaTecnicaStatus.CANCELADO) {
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.visitaTecnica.update({
      where: { id: input.visitaId },
      data: { status: VisitaTecnicaStatus.CANCELADO },
    })

    if (visita.pedidoId) {
      await tx.pedido.update({
        where: { id: visita.pedidoId },
        data: { status: PedidoStatus.AGUARDANDO },
      })
    }
  })
}

export async function cancelarVisitaNormal(prisma: PrismaClient, input: CancelarVisitaInput) {
  await cancelarVisita(prisma, input)
}

export async function cancelarVisitaOs(prisma: PrismaClient, input: CancelarVisitaInput) {
  await cancelarVisita(prisma, input)
}

