import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{
    id: string
    lancId: string
  }>
}

export async function DELETE(_: Request, context: RouteContext) {
  const { id, lancId } = await context.params
  if (!id || !lancId) {
    return NextResponse.json({ error: "id e lancId são obrigatórios" }, { status: 400 })
  }

  const lancIdNum = Number(lancId)
  if (!Number.isInteger(lancIdNum)) {
    return NextResponse.json({ error: "lancId inválido" }, { status: 400 })
  }

  const exists = await prisma.userLancamento.findUnique({
    where: { id: lancIdNum },
    select: { userId: true },
  })

  if (!exists || exists.userId !== id) {
    return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 })
  }

  await prisma.userLancamento.delete({ where: { id: lancIdNum } })
  return NextResponse.json({ ok: true })
}

