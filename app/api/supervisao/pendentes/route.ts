import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPedidosPendentes } from "@/domain/supervisao/pedidos-pendentes-usecase"

export async function GET() {
  try {
    const result = await getPedidosPendentes(prisma)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[supervisao][pendentes][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar os pedidos pendentes."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

