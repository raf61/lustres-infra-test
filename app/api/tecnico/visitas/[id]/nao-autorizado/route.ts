import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolvePedidoTipoEspecialByVisita } from "@/domain/pedido/visitas/resolve-tipo-por-visita-usecase"
import { naoAutorizadoNormal, naoAutorizadoOs } from "@/domain/pedido/visitas/nao-autorizado-usecase"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type DenyPayload = {
  motivo: string
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const visitaId = Number.parseInt(id, 10)
    if (Number.isNaN(visitaId)) {
      return NextResponse.json({ error: "Visita inválida." }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as DenyPayload
    if (!body.motivo || !body.motivo.trim()) {
      return NextResponse.json({ error: "Informe o motivo." }, { status: 400 })
    }

    const tipoEspecial = await resolvePedidoTipoEspecialByVisita(prisma, visitaId)
    if (tipoEspecial === "OS") {
      await naoAutorizadoOs(prisma, { visitaId, motivo: body.motivo })
    } else {
      await naoAutorizadoNormal(prisma, { visitaId, motivo: body.motivo })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[tecnico][nao-autorizado][POST]", error)
    const message =
      error instanceof Error ? error.message : "Não foi possível registrar não autorização."
    const status = message === "Visita não encontrada." ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}


