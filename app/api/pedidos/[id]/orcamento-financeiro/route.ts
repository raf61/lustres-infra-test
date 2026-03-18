import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseDateOnlySafe } from "@/lib/date-utils"
import { OrcamentoStatus, PedidoStatus } from "@prisma/client"

import { auth } from "@/auth"

type RouteParams = { id?: string }
type RouteContext = { params?: RouteParams | Promise<RouteParams> }

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" && value !== null && "then" in value && typeof (value as Promise<unknown>).then === "function"

const toPositiveInt = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.floor(value) : null
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed
  }
  return null
}

export async function PATCH(request: Request, context: RouteContext = {}) {
  const rawParams = context.params
  const params = isPromise(rawParams) ? await rawParams : rawParams

  let idParam = params?.id
  if (!idParam) {
    const url = new URL(request.url)
    idParam = url.searchParams.get("id") ?? undefined
  }
  if (!idParam) return NextResponse.json({ error: "ID do pedido não informado." }, { status: 400 })

  const pedidoId = Number.parseInt(idParam, 10)
  if (Number.isNaN(pedidoId)) return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 })

  let body: { parcelas?: number | null; primeiroVencimento?: string | null } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 })
  }

  const parcelas = toPositiveInt(body.parcelas ?? null)
  const primeiroVencimentoDate = parseDateOnlySafe(body.primeiroVencimento ?? null)
  if (body.primeiroVencimento && !primeiroVencimentoDate) {
    return NextResponse.json({ error: "Data do 1º vencimento inválida." }, { status: 400 })
  }

  try {
    const session = await auth()
    const role = session?.user?.role as string
    const isAdminOrFinance = ["MASTER", "ADMINISTRADOR", "FINANCEIRO"].includes(role)

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        status: true,
        orcamentoId: true,
        orcamento: { select: { status: true } },
      },
    })

    if (!pedido || !pedido.orcamentoId) {
      return NextResponse.json({ error: "Pedido ou orçamento não encontrado." }, { status: 404 })
    }

    if (pedido.status === PedidoStatus.CONCLUIDO && !isAdminOrFinance) {
      return NextResponse.json({ error: "Pedidos concluídos não podem alterar o orçamento." }, { status: 400 })
    }

    if (pedido.orcamento?.status === OrcamentoStatus.CANCELADO) {
      return NextResponse.json({ error: "Orçamentos cancelados não podem ser alterados." }, { status: 400 })
    }

    await prisma.orcamento.update({
      where: { id: pedido.orcamentoId },
      data: {
        parcelas,
        primeiroVencimento: primeiroVencimentoDate,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[pedidos/id/orcamento-financeiro][PATCH]", error)
    return NextResponse.json({ error: "Erro ao atualizar parcelas/vencimento do orçamento." }, { status: 500 })
  }
}



