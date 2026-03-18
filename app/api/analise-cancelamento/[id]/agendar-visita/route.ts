import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PedidoStatus, VisitaTecnicaStatus } from "@prisma/client"

type RouteContext = {
    params: Promise<{
        id: string
    }>
}

export async function POST(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params
        const pedidoId = Number.parseInt(id, 10)
        if (Number.isNaN(pedidoId)) {
            return NextResponse.json({ error: "Pedido inválido." }, { status: 400 })
        }

        await prisma.$transaction([
            prisma.pedido.update({
                where: { id: pedidoId },
                data: { status: PedidoStatus.AGUARDANDO },
            }),
            prisma.visitaTecnica.updateMany({
                where: {
                    pedidoId: pedidoId,
                    status: VisitaTecnicaStatus.ANALISE_NAO_AUTORIZADO,
                },
                data: { status: VisitaTecnicaStatus.CANCELADO },
            }),
        ])

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error("[analise-cancelamento][agendar-visita][POST]", error)
        return NextResponse.json({ error: "Não foi possível agendar a visita." }, { status: 500 })
    }
}
