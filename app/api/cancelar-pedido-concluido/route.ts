import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolvePedidoTipoEspecial } from "@/domain/pedido/resolve-tipo-especial-usecase"
import { cancelarPedidoConcluidoNormal, cancelarPedidoConcluidoOs } from "@/domain/pedido/pedidos/cancelar-pedido-concluido-usecase"

type CancelPayload = {
  pedidoId: number
  dataContatoAgendado?: string | null
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as CancelPayload
    const pedidoId = Number(body.pedidoId)
    if (!pedidoId || Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400 })
    }

    let dataContatoAgendado: Date | null = null
    if (body.dataContatoAgendado) {
      const parsed = new Date(body.dataContatoAgendado)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Data de contato inválida." }, { status: 400 })
      }
      dataContatoAgendado = parsed
    }

    const tipoEspecial = await resolvePedidoTipoEspecial(prisma, pedidoId)
    const result =
      tipoEspecial === "OS"
        ? await cancelarPedidoConcluidoOs(prisma, { pedidoId, dataContatoAgendado })
        : await cancelarPedidoConcluidoNormal(prisma, { pedidoId, dataContatoAgendado })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[cancelar-pedido-concluido][POST]", error)
    const message = error instanceof Error ? error.message : "Não foi possível cancelar o pedido."
    const status = message === "Pedido não encontrado." ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

