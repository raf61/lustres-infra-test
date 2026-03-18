import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Context) {
    try {
        const { id } = await params
        const session = await auth()
        const role = session?.user?.role as string

        // Validação de permissão
        if (!["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR"].includes(role)) {
            return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
        }

        const json = await request.json()
        const { vendedorId } = json

        const pedidoId = Number.parseInt(id)
        if (Number.isNaN(pedidoId)) {
            return NextResponse.json({ error: "ID inválido." }, { status: 400 })
        }

        // Buscar pedido para pegar orcamentoId
        const pedido = await prisma.pedido.findUnique({
            where: { id: pedidoId },
            select: { orcamentoId: true }
        })

        if (!pedido) {
            return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
        }

        // Transaction para garantir consistência entre Pedido e Orçamento
        await prisma.$transaction(async (tx) => {
            // Atualiza Pedido
            await tx.pedido.update({
                where: { id: pedidoId },
                data: { vendedorId: vendedorId ?? null },
            })


        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[TROCAR VENDEDOR]", error)
        return NextResponse.json({ error: "Erro interno ao trocar vendedor." }, { status: 500 })
    }
}
