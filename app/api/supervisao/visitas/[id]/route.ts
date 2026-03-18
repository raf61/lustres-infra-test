import { NextResponse } from "next/server"
import { VisitaTecnicaStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { parseDateOnlySafe } from "@/lib/date-utils"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type UpdateVisitaPayload = {
  dataMarcada?: string
  tecnicoId?: string
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const visitaId = Number.parseInt(id, 10)
    if (Number.isNaN(visitaId)) {
      return NextResponse.json({ error: "Visita inválida." }, { status: 400 })
    }

    const body = (await request.json()) as UpdateVisitaPayload
    if (!body.dataMarcada) {
      return NextResponse.json({ error: "Informe a nova data." }, { status: 400 })
    }
    const novaData = parseDateOnlySafe(body.dataMarcada)
    if (!novaData) {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 })
    }

    const visita = await prisma.visitaTecnica.findUnique({
      where: { id: visitaId },
      select: { id: true },
    })

    if (!visita) {
      return NextResponse.json({ error: "Visita técnica não encontrada." }, { status: 404 })
    }

    await prisma.visitaTecnica.update({
      where: { id: visitaId },
      data: {
        dataMarcada: novaData,
        tecnicoId: body.tecnicoId || undefined,
        status: VisitaTecnicaStatus.AGUARDANDO,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[supervisao][visita][PATCH]", error)
    const message = error instanceof Error ? error.message : "Não foi possível atualizar a visita técnica."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

