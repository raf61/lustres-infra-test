import { NextResponse } from "next/server"
import { OrcamentoStatus, PedidoStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getLoggedUserId } from "@/lib/vendor-dashboard"
import { updateClientCategory } from "@/lib/calculate-client-category"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const orcamentoId = Number.parseInt(id, 10)
    if (Number.isNaN(orcamentoId)) {
      return NextResponse.json({ error: "Orçamento inválido." }, { status: 400 })
    }

    const orcamento = await prisma.orcamento.findUnique({
      where: { id: orcamentoId },
      include: {
        itens: true,
        pedido: true,
        cliente: { select: { id: true, categoria: true } },
      },
    })

    if (!orcamento) {
      return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 })
    }

    if (orcamento.pedido) {
      return NextResponse.json({ error: "Este orçamento já possui um pedido associado." }, { status: 400 })
    }

    if (!orcamento.itens.length) {
      return NextResponse.json(
        { error: "Não é possível gerar um pedido sem itens no orçamento." },
        { status: 400 },
      )
    }

    if (orcamento.status === OrcamentoStatus.CANCELADO) {
      return NextResponse.json(
        { error: "Não é possível gerar pedido de orçamento cancelado." },
        { status: 400 },
      )
    }

    if (!orcamento.parcelas || orcamento.parcelas <= 0) {
      return NextResponse.json(
        { error: "Defina o número de parcelas no orçamento antes de tirar o pedido." },
        { status: 400 },
      )
    }

    if (!orcamento.primeiroVencimento) {
      return NextResponse.json(
        { error: "Informe a data do 1º vencimento no orçamento para gerar o pedido." },
        { status: 400 },
      )
    }

    const totalPedido = orcamento.itens.reduce((acc, item) => acc + item.valor * item.quantidade, 0)

    // Pedido sempre fica vinculado a quem está gerando
    const currentUserId = await getLoggedUserId()

    if (!currentUserId) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
    }

    const vendedorId = currentUserId

    const { contratoId } = await _.json().catch(() => ({}))

    const createdPedido = await prisma.$transaction(async (tx) => {
      const itensIds = orcamento.itens.map((i) => i.itemId)
      const itensDb = await tx.item.findMany({
        where: { id: { in: itensIds } },
        select: { id: true, categoria: true, estoque: true, nome: true },
      })
      const itemInfo = new Map<bigint, { categoria: string | null; estoque: number; nome: string }>()
      itensDb.forEach((i) => itemInfo.set(i.id, { categoria: i.categoria, estoque: i.estoque, nome: i.nome }))

      await tx.orcamento.update({
        where: { id: orcamento.id },
        data: { status: OrcamentoStatus.APROVADO },
      })

      const pedido = await tx.pedido.create({
        data: {
          orcamentoId: orcamento.id,
          clienteId: orcamento.clienteId,
          vendedorId,
          contratoId: contratoId ? Number(contratoId) : null,
          status: PedidoStatus.AGUARDANDO,
          observacoes: orcamento.observacoes,
          // Registrar a categoria do cliente no momento da venda
          categoriaClienteNoMomento: orcamento.cliente.categoria,
        },
      })

      await tx.pedidoItem.createMany({
        data: orcamento.itens.map((item) => ({
          pedidoId: pedido.id,
          itemId: item.itemId,
          quantidade: item.quantidade,
          valorUnitarioPraticado: item.valor,
        })),
      })

      // Baixa de estoque pelos itens do pedido (somente categoria Produto)
      for (const item of orcamento.itens) {
        const info = itemInfo.get(item.itemId)
        if (!info || info.categoria === "Serviço") continue

        const estoqueAntes = info.estoque
        if (estoqueAntes - item.quantidade < 0) {
          throw new Error(`Estoque insuficiente para ${info.nome}`)
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
            totalAntes: estoqueAntes,
            observacao: `Saída por criação do pedido #${pedido.id}`,
          },
        })
      }

      return pedido
    })

    await prisma.client.update({
      where: { id: orcamento.clienteId },
      data: { dataContatoAgendado: null, ultimaManutencao: createdPedido.createdAt },
    })

    await updateClientCategory(orcamento.clienteId)

    return NextResponse.json(
      {
        id: createdPedido.id,
        status: createdPedido.status,
        clienteId: createdPedido.clienteId,
        orcamentoId: createdPedido.orcamentoId,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[orcamentos][pedido][POST]", error)
    const message = error instanceof Error ? error.message : "Erro ao gerar pedido."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

