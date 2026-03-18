import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PedidoStatus } from "@prisma/client"
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

  let payload: { items?: Array<{ itemId: number; quantidade: number; valorUnitario: number }> } = {}
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 })
  }

  const items = payload.items ?? []
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Informe ao menos um item." }, { status: 400 })
  }

  try {
    const session = await auth()
    const role = session?.user?.role as string
    const isAdminOrFinance = ["MASTER", "ADMINISTRADOR", "FINANCEIRO"].includes(role)

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { status: true, orcamentoId: true },
    })

    if (!pedido) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
    }

    if (pedido.status === PedidoStatus.CONCLUIDO && !isAdminOrFinance) {
      return NextResponse.json({ error: "Pedidos concluídos não podem ser alterados." }, { status: 400 })
    }

    const parsedItems = items.map((i) => {
      const itemIdNumber = Number.parseInt(String(i.itemId), 10)
      if (!Number.isFinite(itemIdNumber) || itemIdNumber <= 0) {
        throw new Error("Produto/serviço inválido.")
      }
      const quantidade = Number.parseInt(String(i.quantidade), 10)
      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        throw new Error("Quantidade inválida.")
      }
      const valor = Number.parseFloat(String(i.valorUnitario))
      const valorUnitario = Number.isFinite(valor) && valor >= 0 ? valor : 0

      return {
        pedidoId,
        itemId: BigInt(itemIdNumber),
        quantidade,
        valorUnitarioPraticado: valorUnitario,
      }
    })

    await prisma.$transaction([
      prisma.pedidoItem.deleteMany({ where: { pedidoId } }),
      prisma.pedidoItem.createMany({
        data: parsedItems,
      }),
      prisma.pedido.update({
        where: { id: pedidoId },
        data: { updatedAt: new Date() },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[pedidos/id/items][PATCH]", error)
    const message = error instanceof Error ? error.message : "Erro ao atualizar itens do pedido."
    const status = message.includes("inválid") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
