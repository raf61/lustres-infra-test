import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolvePedidoTipoEspecialByVisita } from "@/domain/pedido/visitas/resolve-tipo-por-visita-usecase"
import { cancelarVisitaNormal, cancelarVisitaOs } from "@/domain/pedido/visitas/cancelar-visita-usecase"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const visitaId = Number.parseInt(id, 10)
    if (Number.isNaN(visitaId)) {
      return NextResponse.json({ error: "Visita inválida." }, { status: 400 })
    }

    const tipoEspecial = await resolvePedidoTipoEspecialByVisita(prisma, visitaId)
    if (tipoEspecial === "OS") {
      await cancelarVisitaOs(prisma, { visitaId })
    } else {
      await cancelarVisitaNormal(prisma, { visitaId })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[supervisao][visita][cancelar][POST]", error)
    const message = error instanceof Error ? error.message : "Não foi possível cancelar a visita técnica."
    const status = message === "Visita técnica não encontrada." ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

