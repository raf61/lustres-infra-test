import { ListaExtraStatus, PedidoStatus, PrismaClient } from "@prisma/client"

type AprovarListaExtraInput = {
  listaId: number
}

async function aprovarListaExtra(
  prisma: PrismaClient,
  input: AprovarListaExtraInput
) {
  const lista = await prisma.listaExtra.findUnique({
    where: { id: input.listaId },
    include: {
      visita: { select: { id: true, pedidoId: true } },
      itens: {
        select: {
          id: true,
          itemId: true,
          quantidade: true,
          valorPraticado: true,
        },
      },
    },
  })

  if (!lista) {
    throw new Error("Lista extra não encontrada.")
  }

  if (lista.status !== ListaExtraStatus.PENDENTE) {
    throw new Error("Apenas listas pendentes podem ser aprovadas.")
  }

  if (!lista.visita?.pedidoId) {
    throw new Error("Lista extra não está vinculada a um pedido.")
  }

  const pedidoId = lista.visita.pedidoId
  const itensParaAprovar = lista.itens.filter((item) => item.quantidade > 0)

  if (!itensParaAprovar.length) {
    throw new Error("Lista extra sem itens para aprovar.")
  }

  if (itensParaAprovar.some((item) => item.quantidade <= 0)) {
    throw new Error("Quantidade de item inválida (<= 0).")
  }

  await prisma.$transaction(async (tx) => {
    const itensIds = itensParaAprovar.map((i) => i.itemId)
    const itensDb = await tx.item.findMany({
      where: { id: { in: itensIds } },
      select: { id: true, categoria: true, estoque: true, nome: true, valor: true },
    })
    const itensInfo = new Map<bigint, { categoria: string | null; estoque: number; nome: string; valor: number }>()
    itensDb.forEach((i) => itensInfo.set(i.id, { categoria: i.categoria, estoque: i.estoque, nome: i.nome, valor: i.valor }))

    for (const item of itensParaAprovar) {
      const existing = await tx.pedidoItem.findFirst({
        where: { pedidoId, itemId: item.itemId },
        select: { id: true, quantidade: true },
      })

      const info = itensInfo.get(item.itemId)
      const isProduto = info?.categoria !== "Serviço"
      if (isProduto) {
        const estoqueAntes = info?.estoque ?? 0
        if (estoqueAntes - item.quantidade < 0) {
          throw new Error(`Estoque insuficiente para ${info?.nome ?? "produto"} (lista extra).`)
        }
        await tx.item.update({
          where: { id: item.itemId },
          data: { estoque: { decrement: item.quantidade } },
        })
        await tx.movimentacaoEstoque.create({
          data: {
            tipo: "SAIDA",
            itemId: item.itemId,
            quantidade: item.quantidade,
            totalAntes: info?.estoque ?? 0,
            observacao: `Saída por lista extra aprovada (pedido #${pedidoId})`,
          },
        })
      }

      const valorFinal = item.valorPraticado > 0 ? item.valorPraticado : (info?.valor ?? 0)
      if (existing) {
        const novaQuantidade = existing.quantidade + item.quantidade
        if (novaQuantidade <= 0) {
          throw new Error("Quantidade resultante inválida para item do pedido.")
        }
        await tx.pedidoItem.update({
          where: { id: existing.id },
          data: {
            quantidade: novaQuantidade,
            valorUnitarioPraticado: valorFinal,
          },
        })
      } else {
        await tx.pedidoItem.create({
          data: {
            pedidoId,
            itemId: item.itemId,
            quantidade: item.quantidade,
            valorUnitarioPraticado: valorFinal,
          },
        })
      }
    }

    await tx.pedido.update({
      where: { id: pedidoId },
      data: { status: PedidoStatus.AGUARDANDO },
    })

    await tx.listaExtra.update({
      where: { id: input.listaId },
      data: { status: ListaExtraStatus.APROVADO },
    })
  }, { timeout: 10000 })
}

export async function aprovarListaExtraNormal(
  prisma: PrismaClient,
  input: AprovarListaExtraInput
) {
  await aprovarListaExtra(prisma, input)
}

