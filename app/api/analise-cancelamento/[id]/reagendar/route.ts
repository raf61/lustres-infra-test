import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { updateClientCategory } from "@/lib/calculate-client-category"
import { resolvePedidoTipoEspecial } from "@/domain/pedido/resolve-tipo-especial-usecase"
import { concluirAnaliseCancelamentoNormal, concluirAnaliseCancelamentoOs } from "@/domain/pedido/pedidos/concluir-analise-cancelamento-usecase"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type ReagendarPayload = {
  ultimaManutencao?: string | null
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const pedidoId = Number.parseInt(id, 10)
    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as ReagendarPayload

    const tipoEspecial = await resolvePedidoTipoEspecial(prisma, pedidoId)
    const result =
      tipoEspecial === "OS"
        ? await concluirAnaliseCancelamentoOs(prisma, { pedidoId, ultimaManutencao: body.ultimaManutencao ?? null })
        : await concluirAnaliseCancelamentoNormal(prisma, { pedidoId, ultimaManutencao: body.ultimaManutencao ?? null })

    if (result.clienteId) {
      await updateClientCategory(result.clienteId, prisma)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[analise-cancelamento][reagendar][POST]", error)
    const message =
      error instanceof Error ? error.message : "Não foi possível concluir o cancelamento."
    const status = message === "Pedido não encontrado." ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}


