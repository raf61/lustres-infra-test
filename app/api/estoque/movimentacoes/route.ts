import { NextResponse } from "next/server"
import { MovimentacaoEstoqueTipo } from "@prisma/client"

import { prisma } from "@/lib/prisma"

type PostPayload = {
  itemId?: number
  tipo?: "ENTRADA" | "SAIDA"
  quantidade?: number
  observacao?: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const itemIdParam = searchParams.get("itemId")
    const itemId = itemIdParam ? Number.parseInt(itemIdParam, 10) : null

    const movimentacoes = await prisma.movimentacaoEstoque.findMany({
      where: itemId ? { itemId: BigInt(itemId) } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        item: { select: { nome: true, categoria: true } },
      },
    })

    return NextResponse.json({
      data: movimentacoes.map((mov) => ({
        id: mov.id,
        tipo: mov.tipo,
        itemId: Number(mov.itemId),
        itemNome: mov.item?.nome ?? "",
        categoria: mov.item?.categoria ?? null,
        quantidade: mov.quantidade,
        totalAntes: mov.totalAntes,
        totalDepois: mov.tipo === MovimentacaoEstoqueTipo.ENTRADA ? mov.totalAntes + mov.quantidade : mov.totalAntes - mov.quantidade,
        observacao: mov.observacao,
        createdAt: mov.createdAt,
      })),
    })
  } catch (error) {
    console.error("[estoque][movimentacoes][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar o histórico."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as PostPayload
    const itemId = body.itemId ? Number.parseInt(String(body.itemId), 10) : NaN
    const quantidade = Number(body.quantidade)
    const tipo = body.tipo === "ENTRADA" ? MovimentacaoEstoqueTipo.ENTRADA : body.tipo === "SAIDA" ? MovimentacaoEstoqueTipo.SAIDA : null
    const observacao = body.observacao?.trim() ?? ""

    if (!tipo) {
      return NextResponse.json({ error: "Tipo inválido." }, { status: 400 })
    }
    if (!Number.isFinite(itemId)) {
      return NextResponse.json({ error: "Item inválido." }, { status: 400 })
    }
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return NextResponse.json({ error: "Quantidade deve ser maior que zero." }, { status: 400 })
    }

    const item = await prisma.item.findUnique({ where: { id: BigInt(itemId) } })
    if (!item) {
      return NextResponse.json({ error: "Item não encontrado." }, { status: 404 })
    }
    if (item.categoria === "Serviço") {
      return NextResponse.json({ error: "Serviços não possuem movimentação de estoque." }, { status: 400 })
    }

    const totalAntes = item.estoque
    const totalDepois =
      tipo === MovimentacaoEstoqueTipo.ENTRADA ? totalAntes + quantidade : totalAntes - quantidade

    if (tipo === MovimentacaoEstoqueTipo.SAIDA && totalDepois < 0) {
      return NextResponse.json({ error: "Estoque insuficiente para saída." }, { status: 400 })
    }

    const mov = await prisma.$transaction(async (tx) => {
      await tx.item.update({
        where: { id: BigInt(itemId) },
        data: {
          estoque: {
            [tipo === MovimentacaoEstoqueTipo.ENTRADA ? "increment" : "decrement"]: quantidade,
          },
        },
      })

      return tx.movimentacaoEstoque.create({
        data: {
          tipo,
          itemId: BigInt(itemId),
          quantidade,
          totalAntes,
          observacao: observacao || "Movimentação manual",
        },
      })
    })

    return NextResponse.json({ data: { id: mov.id } }, { status: 201 })
  } catch (error) {
    console.error("[estoque][movimentacoes][POST]", error)
    const message = error instanceof Error ? error.message : "Não foi possível registrar a movimentação."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

