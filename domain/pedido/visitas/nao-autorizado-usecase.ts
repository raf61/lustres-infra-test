import { PedidoStatus, PrismaClient, VisitaTecnicaStatus } from "@prisma/client"

type NaoAutorizadoInput = {
  visitaId: number
  motivo: string
}

async function naoAutorizado(
  prisma: PrismaClient,
  input: NaoAutorizadoInput
) {
  const visita = await prisma.visitaTecnica.findUnique({
    where: { id: input.visitaId },
    select: { id: true, pedidoId: true },
  })

  if (!visita) {
    throw new Error("Visita não encontrada.")
  }

  if (!visita.pedidoId) {
    throw new Error("Visita sem pedido associado.")
  }

  await prisma.$transaction([
    prisma.visitaTecnica.update({
      where: { id: input.visitaId },
      data: {
        status: VisitaTecnicaStatus.ANALISE_NAO_AUTORIZADO,
        motivo_nao_autorizado: input.motivo.trim(),
      },
    }),
    prisma.pedido.update({
      where: { id: visita.pedidoId },
      data: {
        status: PedidoStatus.ANALISE_CANCELAMENTO_SUPERVISAO,
      },
    }),
  ])
}

export async function naoAutorizadoNormal(prisma: PrismaClient, input: NaoAutorizadoInput) {
  await naoAutorizado(prisma, input)
}

export async function naoAutorizadoOs(prisma: PrismaClient, input: NaoAutorizadoInput) {
  await naoAutorizado(prisma, input)
}

