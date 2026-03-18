import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolvePedidoTipoEspecial } from "@/domain/pedido/resolve-tipo-especial-usecase"
import { aprovarSupervisaoNormal, aprovarSupervisaoOs } from "@/domain/pedido/aprovacoes/aprovar-supervisao-usecase"

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
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400 })
    }

    const tipoEspecial = await resolvePedidoTipoEspecial(prisma, pedidoId)
    if (tipoEspecial === "OS") {
      await aprovarSupervisaoOs(prisma, { pedidoId })
    } else {
      await aprovarSupervisaoNormal(prisma, { pedidoId })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[supervisao][aprovacoes][aprovar][POST]", error)
    const message =
      error instanceof Error ? error.message : "Não foi possível aprovar este pedido."
    const status = message === "Pedido não encontrado." ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

