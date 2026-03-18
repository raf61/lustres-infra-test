import { NextResponse } from "next/server"
import { PedidoStatus, VisitaTecnicaStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getVisitasAgendadas } from "@/domain/supervisao/visitas-agendadas-usecase"
import { parseDateOnlySafe } from "@/lib/date-utils"
import { getLoggedUserId } from "@/lib/vendor-dashboard"
import { resolvePedidoTipoEspecial } from "@/domain/pedido/resolve-tipo-especial-usecase"
import { criarVisitaNormal, criarVisitaOs } from "@/domain/pedido/visitas/criar-visita-usecase"

export async function GET() {
  try {
    const result = await getVisitasAgendadas(prisma)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[supervisao][visitas][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar as visitas técnicas."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

type CreateVisitaPayload = {
  pedidoId?: number | null
  orcamentoId: number
  clienteId: number
  dataMarcada: string
  tecnicoId?: string
  creatorId?: string
  observacao?: string | null
}

export async function POST(request: Request) {
  try {
    // Obtém o ID do usuário logado (será o creatorId)
    const currentUserId = await getLoggedUserId()
    
    if (!currentUserId) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
    }
    
    const body = (await request.json()) as CreateVisitaPayload

    const { clienteId, orcamentoId, dataMarcada } = body
    if (!clienteId || !orcamentoId || !dataMarcada) {
      return NextResponse.json({ error: "Dados obrigatórios ausentes." }, { status: 400 })
    }

    const visitaDate = parseDateOnlySafe(dataMarcada)
    if (!visitaDate) {
      return NextResponse.json({ error: "Data de agendamento inválida." }, { status: 400 })
    }

    const pedidoId = body.pedidoId ?? null
    const tecnicoId = body.tecnicoId
    const creatorId = currentUserId
    const observacao = body.observacao ?? null

    if (!tecnicoId) {
      return NextResponse.json({ error: "Técnico é obrigatório." }, { status: 400 })
    }

    const tipoEspecial = pedidoId ? await resolvePedidoTipoEspecial(prisma, pedidoId) : null
    const visita =
      tipoEspecial === "OS"
        ? await criarVisitaOs(prisma, {
            pedidoId,
            orcamentoId,
            clienteId,
            dataMarcada: visitaDate,
            tecnicoId,
            creatorId,
            observacao,
          })
        : await criarVisitaNormal(prisma, {
            pedidoId,
            orcamentoId,
            clienteId,
            dataMarcada: visitaDate,
            tecnicoId,
            creatorId,
            observacao,
          })

    return NextResponse.json({ id: visita.id }, { status: 201 })
  } catch (error) {
    console.error("[supervisao][visitas][POST]", error)
    const message = error instanceof Error ? error.message : "Não foi possível distribuir o pedido."
    const status = message === "Pedido não encontrado." || message === "Cliente não encontrado." || message === "Orçamento não encontrado."
      ? 404
      : 400
    return NextResponse.json({ error: message }, { status })
  }
}

