import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const categorias = await (prisma as any).contaPagarCategoria.findMany({
      orderBy: { nome: "asc" },
    })
    return NextResponse.json({ data: categorias })
  } catch (error) {
    console.error("Erro ao listar categorias de contas a pagar:", error)
    return NextResponse.json({ error: "Erro ao listar categorias." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const nome = (body?.nome ?? "").trim()
    if (!nome) {
      return NextResponse.json({ error: "Nome da categoria é obrigatório." }, { status: 400 })
    }

    const created = await (prisma as any).contaPagarCategoria.create({
      data: { nome },
    })

    return NextResponse.json(created)
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Já existe uma categoria com esse nome." }, { status: 409 })
    }
    console.error("Erro ao criar categoria de contas a pagar:", error)
    return NextResponse.json({ error: "Erro ao criar categoria." }, { status: 500 })
  }
}

