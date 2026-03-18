import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cancelarPedidoImediato } from "@/domain/pedido/pedidos/cancelar-pedido-imediato-usecase"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const pedidoId = Number.parseInt(id, 10)
    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400 })
    }

    await cancelarPedidoImediato(prisma, { pedidoId })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[pedidos][cancelar][POST]", error)
    const message = error instanceof Error ? error.message : "Não foi possível cancelar o pedido."
    const status = message === "Pedido não encontrado." ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
