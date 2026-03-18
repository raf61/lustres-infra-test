import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseDateOnlySafe } from "@/lib/date-utils"
import { createPedidoDebito } from "@/domain/pedido/debitos/create-debito-usecase"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pedidoIdStr } = await params
    const pedidoId = Number.parseInt(pedidoIdStr, 10)

    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "ID de pedido inválido" }, { status: 400 })
    }

    // Verify pedido exists
    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { id: true },
    })

    if (!pedido) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    // Fetch debitos associated with this pedido
    // bancoEmissorId está no Pedido, não no Debito
    const rawDebitos = await prisma.debito.findMany({
      where: { pedidoId: pedidoId },
      select: {
        id: true,
        receber: true,
        stats: true,
        vencimento: true,
        pedido: {
          select: {
            bancoEmissorId: true,
            bancoEmissor: {
              select: {
                bancoCodigo: true,
              },
            },
          },
        },
      },
      orderBy: { vencimento: "asc" },
    })

    // Map to expected format for frontend compatibility
    const debitos = rawDebitos.map((d) => ({
      id: d.id,
      valor: d.receber,
      status: d.stats,
      vencimento: d.vencimento,
      bancoEmissorId: d.pedido?.bancoEmissorId ?? null,
      bancoCodigo: d.pedido?.bancoEmissor?.bancoCodigo ?? null,
    }))

    return NextResponse.json({ debitos })
  } catch (error) {
    console.error("[pedidos/[id]/debitos][GET]", error)
    return NextResponse.json(
      { error: "Erro ao buscar débitos do pedido" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pedidoIdStr } = await params
    const pedidoId = Number.parseInt(pedidoIdStr, 10)

    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "ID de pedido inválido" }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      valor?: number
      vencimento?: string
    }

    const valor = Number(body.valor)
    if (!valor || Number.isNaN(valor) || valor <= 0) {
      return NextResponse.json({ error: "Valor inválido." }, { status: 400 })
    }

    const vencimento = parseDateOnlySafe(body.vencimento)
    if (!vencimento) {
      return NextResponse.json({ error: "Vencimento inválido." }, { status: 400 })
    }

    const result = await createPedidoDebito(prisma, {
      pedidoId,
      valor,
      vencimento,
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    console.error("[pedidos/[id]/debitos][POST]", error)
    const message = error instanceof Error ? error.message : "Erro ao criar débito."
    const status = message.includes("inválid") || message.includes("não encontrado") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

