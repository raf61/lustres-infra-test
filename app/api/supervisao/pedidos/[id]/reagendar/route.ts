import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolvePedidoTipoEspecial } from "@/domain/pedido/resolve-tipo-especial-usecase"
import { reagendarPedidoNormal, reagendarPedidoOs } from "@/domain/pedido/pedidos/reagendar-pedido-usecase"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const pedidoId = Number.parseInt(id, 10)
    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400 })
    }

    const tipoEspecial = await resolvePedidoTipoEspecial(prisma, pedidoId)
    if (tipoEspecial === "OS") {
      await reagendarPedidoOs(prisma, { pedidoId })
    } else {
      await reagendarPedidoNormal(prisma, { pedidoId })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[supervisao][pedido][reagendar][POST]", error)
    const message =
      error instanceof Error ? error.message : "Não foi possível reagendar o pedido."
    const status = message === "Pedido não encontrado." ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}


