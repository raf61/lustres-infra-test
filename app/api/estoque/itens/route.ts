import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

type PostPayload = {
  nome?: string
  valor?: number
  categoria?: "Produto" | "Serviço"
  fornecedor?: string | null
  urlFoto?: string | null
  precoCusto?: number | null
}

export async function GET() {
  try {
    const itens = await prisma.item.findMany({
      orderBy: { nome: "asc" },
    })

    return NextResponse.json({
      data: itens.map((item) => ({
        id: Number(item.id),
        nome: item.nome,
        valor: item.valor, // preço médio de venda
        categoria: item.categoria ?? "Produto",
        estoque: item.estoque,
        fornecedor: item.fornecedor,
        urlFoto: item.urlFoto,
        precoCusto: item.precoCusto,
      })),
    })
  } catch (error) {
    console.error("[estoque][itens][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar os itens."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as PostPayload
    const nome = body.nome?.trim()
    const valor = Number(body.valor)
    const categoria = body.categoria === "Serviço" ? "Serviço" : "Produto"
    const fornecedor = body.fornecedor?.trim() || null
    const urlFoto = body.urlFoto?.trim() || null
    const precoCusto =
      body.precoCusto === null || body.precoCusto === undefined ? null : Number(body.precoCusto)

    if (!nome) {
      return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 })
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ error: "Valor deve ser maior que zero." }, { status: 400 })
    }
    if (precoCusto !== null && (!Number.isFinite(precoCusto) || precoCusto < 0)) {
      return NextResponse.json({ error: "Preço de custo deve ser zero ou maior." }, { status: 400 })
    }

    const created = await prisma.item.create({
      data: {
        nome,
        valor,
        categoria,
        estoque: 0,
        fornecedor,
        urlFoto,
        precoCusto,
      },
    })

    return NextResponse.json(
      {
        data: {
          id: Number(created.id),
          nome: created.nome,
          valor: created.valor,
          categoria: created.categoria ?? "Produto",
          estoque: created.estoque,
          fornecedor: created.fornecedor,
          urlFoto: created.urlFoto,
          precoCusto: created.precoCusto,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[estoque][itens][POST]", error)
    const message = error instanceof Error ? error.message : "Não foi possível criar o item."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

