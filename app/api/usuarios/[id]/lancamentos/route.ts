import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 })

  const data = await prisma.userLancamento.findMany({
    where: { userId: id },
    orderBy: { data: "desc" },
  })

  return NextResponse.json({ data })
}

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 })

  const body = await req.json()
  const { tipo, data, descricao, valor } = body ?? {}

  if (!tipo || !data || !descricao || valor === undefined || valor === null) {
    return NextResponse.json({ error: "Campos obrigatórios: tipo, data, descricao, valor" }, { status: 400 })
  }

  // No Brasil (UTC-3), uma data como "2026-03-20" vira 21:00 do dia 19 em UTC 00:00.
  // Para salvar o dia correto como "Meia-noite de Brasília", somamos 3 horas (03:00 UTC).
  const parsedDate = new Date(data)
  if (!data.includes("T")) {
    parsedDate.setUTCHours(3)
  }

  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Data inválida" }, { status: 400 })
  }

  const numValor = Number(valor)
  if (!Number.isFinite(numValor)) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
  }

  const created = await prisma.userLancamento.create({
    data: {
      id: body.id ?? undefined,
      userId: id,
      data: parsedDate,
      descricao,
      valor: numValor,
      tipo,
    },
  })

  return NextResponse.json({ data: created })
}

