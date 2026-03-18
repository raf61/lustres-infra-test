import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type PatchPayload = {
  nome?: string
  valor?: number
  categoria?: "Produto" | "Serviço"
  fornecedor?: string | null
  urlFoto?: string | null
  precoCusto?: number | null
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const itemId = Number.parseInt(id, 10)
    if (Number.isNaN(itemId)) {
      return NextResponse.json({ error: "Item inválido." }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as PatchPayload

    const data: any = {}

    if (typeof body.nome === "string") {
      const nome = body.nome.trim()
      if (!nome) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 })
      data.nome = nome
    }

    if (body.valor !== undefined) {
      const valor = Number(body.valor)
      if (!Number.isFinite(valor) || valor < 0) {
        return NextResponse.json({ error: "Valor deve ser maior que zero." }, { status: 400 })
      }
      data.valor = valor
    }

    if (body.categoria !== undefined) {
      data.categoria = body.categoria === "Serviço" ? "Serviço" : "Produto"
    }

    if (body.fornecedor !== undefined) {
      data.fornecedor = body.fornecedor?.trim() || null
    }

    if (body.urlFoto !== undefined) {
      data.urlFoto = body.urlFoto?.trim() || null
    }

    if (body.precoCusto !== undefined) {
      const precoCusto = body.precoCusto === null ? null : Number(body.precoCusto)
      if (precoCusto !== null && (!Number.isFinite(precoCusto) || precoCusto < 0)) {
        return NextResponse.json({ error: "Preço de custo deve ser zero ou maior." }, { status: 400 })
      }
      data.precoCusto = precoCusto
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 })
    }

    const updated = await prisma.item.update({
      where: { id: BigInt(itemId) },
      data,
    })

    return NextResponse.json({
      data: {
        id: Number(updated.id),
        nome: updated.nome,
        valor: updated.valor,
        categoria: updated.categoria ?? "Produto",
        estoque: updated.estoque,
        fornecedor: updated.fornecedor,
        urlFoto: updated.urlFoto,
        precoCusto: updated.precoCusto,
      },
    })
  } catch (error) {
    console.error("[estoque][itens][PATCH]", error)
    const message = error instanceof Error ? error.message : "Não foi possível atualizar o item."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const itemId = Number.parseInt(id, 10)
    if (Number.isNaN(itemId)) {
      return NextResponse.json({ error: "Item inválido." }, { status: 400 })
    }

    // Verifica se há mais de 50 usos em PedidoItem
    const usageCount = await prisma.pedidoItem.count({
      where: { itemId: BigInt(itemId) },
    })

    if (usageCount > 50) {
      return NextResponse.json({
        error: `Não é possível apagar este item pois ele já está vinculado a ${usageCount} pedidos (limite de 50).`
      }, { status: 400 })
    }

    await prisma.item.delete({
      where: { id: BigInt(itemId) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[estoque][itens][DELETE]", error)
    const message = error instanceof Error ? error.message : "Não foi possível apagar o item."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}




