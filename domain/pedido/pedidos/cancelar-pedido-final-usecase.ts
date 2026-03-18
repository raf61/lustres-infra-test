import { MovimentacaoEstoqueTipo, OrcamentoStatus, PedidoStatus, Prisma, PrismaClient, VisitaTecnicaStatus } from "@prisma/client"
import { updateClientCategory } from "@/lib/calculate-client-category"

type CancelarPedidoFinalInput = {
  pedidoId: number
  clientUpdateData?: Prisma.ClientUpdateInput | null
}

export async function cancelarPedidoFinal(
  prisma: PrismaClient,
  input: CancelarPedidoFinalInput
) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: input.pedidoId },
    select: {
      id: true,
      clienteId: true,
      orcamentoId: true,
      itens: {
        include: {
          item: {
            select: {
              id: true,
              categoria: true,
              estoque: true,
            },
          },
        },
      },
    },
  })

  if (!pedido) {
    throw new Error("Pedido não encontrado.")
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.pedido.update({
      where: { id: input.pedidoId },
      data: { status: PedidoStatus.CANCELADO },
    }),
    prisma.visitaTecnica.updateMany({
      where: {
        pedidoId: input.pedidoId,
        status: { notIn: [VisitaTecnicaStatus.CANCELADO, VisitaTecnicaStatus.FINALIZADO] },
      },
      data: { status: VisitaTecnicaStatus.CANCELADO },
    }),
    prisma.debito.updateMany({
      where: {
        pedidoId: input.pedidoId,
        stats: 0,
      },
      data: { stats: -1 },
    }),
  ]

  // Devolver itens ao estoque
  for (const pedidoItem of pedido.itens) {
    const item = pedidoItem.item
    if (item && item.categoria !== "Serviço") {
      const novaQuantidade = item.estoque + pedidoItem.quantidade

      if (novaQuantidade > 2147483647) {
        throw new Error(
          `Erro ao cancelar: O estoque do item "${item.id}" excederia o limite máximo permitido (2.1bi). Estoque atual: ${item.estoque}, qtd a devolver: ${pedidoItem.quantidade}.`
        )
      }

      ops.push(
        prisma.item.update({
          where: { id: item.id },
          data: { estoque: { increment: pedidoItem.quantidade } },
        }),
        prisma.movimentacaoEstoque.create({
          data: {
            tipo: MovimentacaoEstoqueTipo.ENTRADA,
            itemId: item.id,
            quantidade: pedidoItem.quantidade,
            totalAntes: item.estoque,
            observacao: `Estorno por cancelamento do pedido #${pedido.id}`,
          },
        })
      )
    }
  }

  if (pedido.orcamentoId) {
    ops.push(
      prisma.orcamento.update({
        where: { id: pedido.orcamentoId },
        data: { status: OrcamentoStatus.CANCELADO },
      })
    )
  }

  if (pedido.clienteId && input.clientUpdateData && Object.keys(input.clientUpdateData).length > 0) {
    ops.push(
      prisma.client.update({
        where: { id: pedido.clienteId },
        data: input.clientUpdateData,
      })
    )
  }

  await prisma.$transaction(ops, { timeout: 15000 } as any)

  if (pedido.clienteId) {
    await updateClientCategory(pedido.clienteId, prisma)
  }

  return pedido
}
