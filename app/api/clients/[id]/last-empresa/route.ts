import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const clienteId = Number.parseInt(id, 10)
    if (Number.isNaN(clienteId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    const ultimo = await prisma.orcamento.findFirst({
      where: { clienteId, empresaId: { not: null } },
      select: { empresaId: true },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ empresaId: ultimo?.empresaId ?? null })
  } catch (error) {
    console.error("[clients][last-empresa][GET]", error)
    return NextResponse.json({ error: "Não foi possível obter empresa padrão." }, { status: 500 })
  }
}

