import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PedidoStatus } from "@prisma/client"

type RouteContext = {
    params: Promise<{
        id: string
    }>
}

export async function POST(_request: Request, context: RouteContext) {
    try {
        const { id } = await context.params
        const pedidoId = Number.parseInt(id, 10)
        if (Number.isNaN(pedidoId)) {
            return NextResponse.json({ error: "Pedido inválido." }, { status: 400 })
        }

        const pedido = await prisma.pedido.findUnique({
            where: { id: pedidoId },
            select: { id: true, status: true },
        })

        if (!pedido) {
            return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
        }

        await prisma.pedido.update({
            where: { id: pedidoId },
            data: { status: PedidoStatus.AGUARDANDO },
        })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("[admin][aprovacoes][reagendar][POST]", error)
        const message =
            error instanceof Error ? error.message : "Não foi possível reagendar o pedido."
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
