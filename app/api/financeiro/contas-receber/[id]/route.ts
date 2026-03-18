import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { parseDateOnlySafe } from "@/lib/date-utils"

type RouteParams = { id?: string }
type RouteContext = { params?: RouteParams | Promise<RouteParams> }

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" && value !== null && "then" in value && typeof (value as any).then === "function"

const getIdFromParams = async (params?: RouteParams | Promise<RouteParams>) => {
  const resolved = isPromise(params) ? await params : params
  const id = Number(resolved?.id)
  if (!id || Number.isNaN(id)) {
    throw new Error("ID inválido")
  }
  return id
}

export async function PATCH(request: Request, context: RouteContext = {}) {
  let debitoId: number
  try {
    debitoId = await getIdFromParams(context.params)
  } catch {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    valorRecebido?: number
    dataOcorrencia?: string
    acrescimos?: number
    descontos?: number
  }

  const valorRecebido = Number(body.valorRecebido)
  if (!valorRecebido || Number.isNaN(valorRecebido) || valorRecebido <= 0) {
    return NextResponse.json({ error: "Valor recebido inválido." }, { status: 400 })
  }

  // Se não informada, usa data atual com horário safe
  const dataOcorrencia = body.dataOcorrencia 
    ? parseDateOnlySafe(body.dataOcorrencia) 
    : parseDateOnlySafe(new Date().toISOString().split("T")[0])
  if (!dataOcorrencia) {
    return NextResponse.json({ error: "Data de ocorrência inválida." }, { status: 400 })
  }

  const acrescimos = body.acrescimos ? Number(body.acrescimos) : 0
  const descontos = body.descontos ? Number(body.descontos) : 0

  try {
    const debito = await prisma.debito.update({
      where: { id: debitoId },
      data: {
        dataOcorrencia,
        recebido: valorRecebido,
        acrescimos,
        descontos,
        stats: 2,
      },
      select: { id: true },
    })

    return NextResponse.json({ data: { id: debito.id } })
  } catch (error) {
    console.error("[financeiro][contas-receber][PATCH]", error)
    return NextResponse.json({ error: "Erro ao registrar baixa manual." }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: RouteContext = {}) {
  let debitoId: number
  try {
    debitoId = await getIdFromParams(context.params)
  } catch {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 })
  }

  try {
    await prisma.debito.delete({ where: { id: debitoId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[financeiro][contas-receber][DELETE]", error)
    const message = error instanceof Error ? error.message : "Erro ao excluir."
    if (message.toLowerCase().includes("record to delete does not exist")) {
      return NextResponse.json({ error: "Débito não encontrado." }, { status: 404 })
    }
    return NextResponse.json({ error: "Erro ao excluir débito." }, { status: 500 })
  }
}


