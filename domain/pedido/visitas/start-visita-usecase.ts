import { PedidoStatus, PrismaClient, VisitaTecnicaStatus } from "@prisma/client"

type StartVisitaInput = {
  visitaId: number
}

async function startVisita(
  prisma: PrismaClient,
  input: StartVisitaInput
) {
  const visita = await prisma.visitaTecnica.findUnique({
    where: { id: input.visitaId },
    select: { status: true, pedidoId: true, tecnicoId: true },
  })

  if (!visita) {
    throw new Error("Visita técnica não encontrada.")
  }

  if (visita.status === VisitaTecnicaStatus.CANCELADO) {
    throw new Error("Visita cancelada não pode ser iniciada.")
  }

  const visitaEmExecucao = await prisma.visitaTecnica.findFirst({
    where: {
      tecnicoId: visita.tecnicoId,
      status: VisitaTecnicaStatus.EM_EXECUCAO,
      id: { not: input.visitaId },
    },
    select: { id: true, cliente: { select: { razaoSocial: true } } },
  })

  if (visitaEmExecucao) {
    const clienteRazao = visitaEmExecucao.cliente?.razaoSocial
    const complemento = clienteRazao ? ` - ${clienteRazao}` : ""
    throw new Error(
      `Você já possui uma manutenção em execução (Visita #${visitaEmExecucao.id}${complemento}). Finalize-a antes de iniciar outra.`
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.visitaTecnica.update({
      where: { id: input.visitaId },
      data: {
        status: VisitaTecnicaStatus.EM_EXECUCAO,
        dataRegistroInicio: new Date(),
      },
    })

    if (visita.pedidoId) {
      await tx.pedido.update({
        where: { id: visita.pedidoId },
        data: { status: PedidoStatus.EXECUCAO },
      })
    }
  })
}

export async function startVisitaNormal(prisma: PrismaClient, input: StartVisitaInput) {
  await startVisita(prisma, input)
}

export async function startVisitaOs(prisma: PrismaClient, input: StartVisitaInput) {
  await startVisita(prisma, input)
}

