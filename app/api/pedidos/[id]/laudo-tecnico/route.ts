import { NextResponse } from "next/server"
import { generateLaudoTecnicoPdfBuffer } from "@/lib/documents/laudo-tecnico"

type RouteContext = {
    params: Promise<{
        id: string
    }>
}

export async function GET(_: Request, context: RouteContext) {
    try {
        const { id } = await context.params
        const pedidoId = Number.parseInt(id, 10)
        if (Number.isNaN(pedidoId)) {
            return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 })
        }

        const result = await generateLaudoTecnicoPdfBuffer({ pedidoId })

        if (!result) {
            return NextResponse.json({ error: "Não foi possível gerar o laudo técnico." }, { status: 404 })
        }

        return new NextResponse(new Uint8Array(result.buffer), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="${result.fileName}"`,
                "Cache-Control": "no-store",
            },
        })
    } catch (error) {
        console.error("[pedidos][laudo-tecnico][GET]", error)
        const message = error instanceof Error ? error.message : "Erro ao gerar laudo técnico."
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
