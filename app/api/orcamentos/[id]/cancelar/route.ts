import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cancelOrcamento } from "@/domain/orcamento/cancel-orcamento-usecase"

type RouteParams = { id?: string }
type RouteContext = { params?: RouteParams | Promise<RouteParams> }

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" && value !== null && "then" in value && typeof (value as Promise<unknown>).then === "function"

export async function POST(_request: Request, context: RouteContext = {}) {
  const rawParams = context.params
  const params = isPromise(rawParams) ? await rawParams : rawParams

  let idParam = params?.id
  if (!idParam) {
    return NextResponse.json({ error: "ID não informado." }, { status: 400 })
  }

  const orcamentoId = Number.parseInt(idParam, 10)
  if (Number.isNaN(orcamentoId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 })
  }

  try {
    const result = await cancelOrcamento(prisma, { orcamentoId })
    return NextResponse.json({ ok: true, alreadyCancelled: result.alreadyCancelled })
  } catch (error) {
    console.error("[orcamentos/id/cancelar][POST]", error)
    const message = error instanceof Error ? error.message : "Erro ao cancelar orçamento."
    const status = message.includes("não encontrado") || message.includes("inválido") ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
