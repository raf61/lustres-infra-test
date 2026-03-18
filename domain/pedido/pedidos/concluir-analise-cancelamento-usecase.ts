import { PedidoStatus, PrismaClient } from "@prisma/client"
import { buildClientUpdateData } from "@/domain/client/transform"
import { cancelarPedidoFinal } from "./cancelar-pedido-final-usecase"

type ConcluirAnaliseCancelamentoInput = {
  pedidoId: number
  ultimaManutencao?: string | null
}

async function concluirAnaliseCancelamento(
  prisma: PrismaClient,
  input: ConcluirAnaliseCancelamentoInput
) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: input.pedidoId },
    select: { id: true, clienteId: true, status: true, orcamentoId: true },
  })

  if (!pedido) {
    throw new Error("Pedido não encontrado.")
  }

  if (pedido.status !== PedidoStatus.ANALISE_CANCELAMENTO) {
    throw new Error("Pedido não está em análise de cancelamento.")
  }

  let clientUpdateData = null
  if (pedido.clienteId && input.ultimaManutencao !== undefined) {
    const buildResult = buildClientUpdateData({ ultimaManutencao: input.ultimaManutencao })
    if (buildResult.ok) {
      clientUpdateData = buildResult.data
    }
  }

  await cancelarPedidoFinal(prisma, {
    pedidoId: input.pedidoId,
    clientUpdateData,
  })

  return pedido
}

export async function concluirAnaliseCancelamentoNormal(
  prisma: PrismaClient,
  input: ConcluirAnaliseCancelamentoInput
) {
  return concluirAnaliseCancelamento(prisma, input)
}

export async function concluirAnaliseCancelamentoOs(
  prisma: PrismaClient,
  input: ConcluirAnaliseCancelamentoInput
) {
  return concluirAnaliseCancelamento(prisma, input)
}


