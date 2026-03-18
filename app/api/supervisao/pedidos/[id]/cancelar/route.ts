import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolvePedidoTipoEspecial } from "@/domain/pedido/resolve-tipo-especial-usecase"
import { cancelarPedidoNormal, cancelarPedidoOs } from "@/domain/pedido/pedidos/cancelar-pedido-usecase"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type CancelPedidoPayload = {
  motivo?: string
  ultimaManutencao?: string | null
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const pedidoId = Number.parseInt(id, 10)
    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as CancelPedidoPayload
    const ultimaManutencaoRaw = body.ultimaManutencao ?? null
    let ultimaManutencao: Date | null = null
    if (ultimaManutencaoRaw) {
      const parsed = new Date(ultimaManutencaoRaw)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Data de última manutenção inválida." }, { status: 400 })
      }
      ultimaManutencao = parsed
    }

    const tipoEspecial = await resolvePedidoTipoEspecial(prisma, pedidoId)
    const result =
      tipoEspecial === "OS"
        ? await cancelarPedidoOs(prisma, { pedidoId, motivo: body.motivo ?? null, ultimaManutencao })
        : await cancelarPedidoNormal(prisma, { pedidoId, motivo: body.motivo ?? null, ultimaManutencao })

    if (result.alreadyCancelled) {
      return NextResponse.json({ message: "Pedido já cancelado." })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[supervisao][pedido][cancelar][POST]", error)
    const message = error instanceof Error ? error.message : "Não foi possível cancelar o pedido."
    const status = message === "Pedido não encontrado." ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

