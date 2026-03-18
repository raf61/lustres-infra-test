import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolvePedidoTipoEspecialByVisita } from "@/domain/pedido/visitas/resolve-tipo-por-visita-usecase"
import { finalizarVisitaNormal } from "@/domain/pedido/visitas/finalizar-visita-normal-usecase"
import { finalizarVisitaOs } from "@/domain/pedido/visitas/finalizar-visita-os-usecase"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type FinalizarPayload = {
  checklistConcluido?: boolean
  itensExtras?: Array<{
    itemId: number
    quantidade: number
    valorUnitario?: number
  }>
  medicaoOhmica?: number
  medicaoOhmicaMulti?: Array<{ torre: string; valor: number }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const visitaId = Number.parseInt(id, 10)
    if (Number.isNaN(visitaId)) {
      return NextResponse.json({ error: "ID da visita inválido." }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as FinalizarPayload
    const tipoEspecial = await resolvePedidoTipoEspecialByVisita(prisma, visitaId)
    if (tipoEspecial === "OS") {
      await finalizarVisitaOs(prisma, {
        visitaId,
        medicaoOhmica: body.medicaoOhmica,
        medicaoOhmicaMulti: body.medicaoOhmicaMulti
      })
    } else {
      await finalizarVisitaNormal(prisma, {
        visitaId,
        checklistConcluido: body.checklistConcluido,
        itensExtras: body.itensExtras,
        medicaoOhmica: body.medicaoOhmica,
        medicaoOhmicaMulti: body.medicaoOhmicaMulti
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[tecnico][visitas][finalizar][POST]", error)
    const message = error instanceof Error ? error.message : "Não foi possível finalizar a visita."
    const status = message === "Visita técnica não encontrada." ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

