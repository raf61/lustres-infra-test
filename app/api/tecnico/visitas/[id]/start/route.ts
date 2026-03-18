import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolvePedidoTipoEspecialByVisita } from "@/domain/pedido/visitas/resolve-tipo-por-visita-usecase"
import { startVisitaNormal, startVisitaOs } from "@/domain/pedido/visitas/start-visita-usecase"

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
      return NextResponse.json({ error: "ID da visita inválido." }, { status: 400 })
    }

    const tipoEspecial = await resolvePedidoTipoEspecialByVisita(prisma, visitaId)
    if (tipoEspecial === "OS") {
      await startVisitaOs(prisma, { visitaId })
    } else {
      await startVisitaNormal(prisma, { visitaId })
    }

    const updated = await prisma.visitaTecnica.findUnique({
      where: { id: visitaId },
      select: { id: true, status: true, dataRegistroInicio: true, pedidoId: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[tecnico][visitas][start][POST]", error)
    const message = error instanceof Error ? error.message : "Não foi possível iniciar a manutenção."
    const status = message === "Visita técnica não encontrada." ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

