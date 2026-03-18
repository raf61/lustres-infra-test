import { PedidoStatus, PrismaClient } from "@prisma/client"

type AprovarFinalOsInput = {
  pedidoId: number
}

export async function aprovarFinalOs(prisma: PrismaClient, input: AprovarFinalOsInput) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: input.pedidoId },
    select: { status: true },
  })

  if (!pedido) {
    throw new Error("Pedido não encontrado.")
  }

  if (pedido.status !== PedidoStatus.AGUARDANDO_APROVACAO_FINAL) {
    throw new Error("Pedido não está aguardando aprovação final.")
  }

  await prisma.pedido.update({
    where: { id: input.pedidoId },
    data: { status: PedidoStatus.CONCLUIDO },
  })
}

