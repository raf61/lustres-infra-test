import { PedidoStatus, PrismaClient } from "@prisma/client"

type AprovarSupervisaoInput = {
  pedidoId: number
}

async function aprovarSupervisao(
  prisma: PrismaClient,
  input: AprovarSupervisaoInput
) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: input.pedidoId },
    select: { status: true },
  })

  if (!pedido) {
    throw new Error("Pedido não encontrado.")
  }

  if (pedido.status !== PedidoStatus.AGUARDANDO_APROVACAO_SUPERVISAO) {
    throw new Error("Pedido não está aguardando aprovação da supervisão.")
  }

  await prisma.pedido.update({
    where: { id: input.pedidoId },
    data: { status: PedidoStatus.AGUARDANDO_APROVACAO_FINAL },
  })
}

export async function aprovarSupervisaoNormal(
  prisma: PrismaClient,
  input: AprovarSupervisaoInput
) {
  await aprovarSupervisao(prisma, input)
}

export async function aprovarSupervisaoOs(
  prisma: PrismaClient,
  input: AprovarSupervisaoInput
) {
  await aprovarSupervisao(prisma, input)
}

