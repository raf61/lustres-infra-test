import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requestArtGeneration } from "@/domain/pedido/art-status-usecase"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const pedidoId = Number.parseInt(id, 10)
    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 })
    }

    const result = await requestArtGeneration(prisma, { pedidoId })

    return NextResponse.json({ data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar a ART."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

