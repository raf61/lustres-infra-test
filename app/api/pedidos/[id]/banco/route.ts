import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

import { auth } from "@/auth"

type RouteParams = {
  id?: string
}

type RouteContext = {
  params?: RouteParams | Promise<RouteParams>
}

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" &&
  value !== null &&
  "then" in value &&
  typeof (value as Promise<unknown>).then === "function"

export async function PATCH(request: Request, context: RouteContext = {}) {
  const rawParams = context.params
  const params = isPromise(rawParams) ? await rawParams : rawParams

  let idParam = params?.id
  if (!idParam) {
    const url = new URL(request.url)
    idParam = url.searchParams.get("id") ?? undefined
  }

  if (!idParam) {
    return NextResponse.json({ error: "ID do pedido não informado." }, { status: 400 })
  }

  const pedidoId = Number.parseInt(idParam, 10)
  if (Number.isNaN(pedidoId)) {
    return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 })
  }

  let payload: { bancoEmissorId?: number } = {}
  try {
    payload = (await request.json()) as { bancoEmissorId?: number }
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 })
  }

  const bancoEmissorId = payload.bancoEmissorId
  if (!bancoEmissorId || Number.isNaN(Number(bancoEmissorId))) {
    return NextResponse.json({ error: "bancoEmissorId é obrigatório." }, { status: 400 })
  }

  try {
    const session = await auth()
    const role = session?.user?.role as string
    const isAdminOrFinance = ["MASTER", "ADMINISTRADOR", "FINANCEIRO"].includes(role)

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { bancoEmissorId: true },
    })

    if (!pedido) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
    }

    if (pedido.bancoEmissorId && !isAdminOrFinance) {
      return NextResponse.json({ error: "Banco já definido para este pedido." }, { status: 400 })
    }

    const banco = await prisma.banco.findUnique({
      where: { id: bancoEmissorId },
      select: { id: true, nome: true },
    })

    if (!banco) {
      return NextResponse.json({ error: "Banco informado não existe." }, { status: 400 })
    }

    const updated = await prisma.pedido.update({
      where: { id: pedidoId },
      data: { bancoEmissorId: bancoEmissorId },
      select: {
        id: true,
        bancoEmissorId: true,
        bancoEmissor: { select: { nome: true } },
      },
    })

    return NextResponse.json({
      data: {
        id: updated.id,
        bancoEmissorId: updated.bancoEmissorId,
        bancoEmissorNome: updated.bancoEmissor?.nome ?? null,
      },
    })
  } catch (error) {
    console.error("[pedidos/id/banco][PATCH]", error)
    return NextResponse.json({ error: "Erro ao definir banco do pedido." }, { status: 500 })
  }
}


