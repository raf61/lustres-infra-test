import { PedidoStatus, PrismaClient, VisitaTecnicaStatus } from "@prisma/client"

type CreateVisitaInput = {
  pedidoId?: number | null
  orcamentoId: number
  clienteId: number
  dataMarcada: Date
  tecnicoId: string
  creatorId: string
  observacao?: string | null
}

async function createVisita(
  prisma: PrismaClient,
  input: CreateVisitaInput
) {
  const cliente = await prisma.client.findUnique({
    where: { id: input.clienteId },
    select: { id: true },
  })
  if (!cliente) {
    throw new Error("Cliente não encontrado.")
  }

  const orcamento = await prisma.orcamento.findUnique({
    where: { id: input.orcamentoId },
    select: { id: true, clienteId: true },
  })
  if (!orcamento) {
    throw new Error("Orçamento não encontrado.")
  }

  if (orcamento.clienteId !== input.clienteId) {
    throw new Error("Orçamento não pertence ao cliente informado.")
  }

  if (input.pedidoId) {
    const pedido = await prisma.pedido.findUnique({
      where: { id: input.pedidoId },
      select: { id: true, status: true },
    })
    if (!pedido) {
      throw new Error("Pedido não encontrado.")
    }
    if (pedido.status === PedidoStatus.CANCELADO) {
      throw new Error("Não é possível distribuir um pedido cancelado.")
    }
  }

  const tecnico = await prisma.user.findUnique({
    where: { id: input.tecnicoId },
    select: { id: true },
  })

  if (!tecnico) {
    throw new Error("Técnico informado não existe.")
  }

  const visita = await prisma.$transaction(async (tx) => {
    const createdVisita = await tx.visitaTecnica.create({
      data: {
        pedidoId: input.pedidoId ?? null,
        orcamentoId: input.orcamentoId,
        clienteId: input.clienteId,
        tecnicoId: tecnico.id,
        creatorId: input.creatorId,
        dataMarcada: input.dataMarcada,
        status: VisitaTecnicaStatus.AGUARDANDO,
        observacao: input.observacao?.trim() ? input.observacao.trim() : null,
      } as any,
    })

    if (input.pedidoId) {
      await tx.pedido.update({
        where: { id: input.pedidoId },
        data: { status: PedidoStatus.AGENDADO },
      })
    }

    return createdVisita
  })

  return visita
}

export async function criarVisitaNormal(prisma: PrismaClient, input: CreateVisitaInput) {
  return createVisita(prisma, input)
}

export async function criarVisitaOs(prisma: PrismaClient, input: CreateVisitaInput) {
  return createVisita(prisma, input)
}

