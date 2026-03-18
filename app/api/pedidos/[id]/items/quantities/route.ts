import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PedidoStatus } from "@prisma/client"
import { auth } from "@/auth"

type RouteParams = {
    id: string
}

type RouteContext = {
    params: Promise<RouteParams>
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const { id: idParam } = await context.params
        const pedidoId = Number.parseInt(idParam, 10)

        if (Number.isNaN(pedidoId)) {
            return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 })
        }

        const payload = await request.json()
        const { items } = payload as { items: Array<{ itemId: number; quantidade: number }> }

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "Informe ao menos um item para atualizar." }, { status: 400 })
        }

        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
        }

        // Busca o pedido para verificar status, itens existentes e dados dos itens
        const pedido = await prisma.pedido.findUnique({
            where: { id: pedidoId },
            include: {
                itens: {
                    include: { item: { select: { nome: true } } }
                }
            }
        })

        if (!pedido) {
            return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
        }

        if (pedido.status === PedidoStatus.CONCLUIDO) {
            return NextResponse.json({ error: "Pedidos concluídos não podem ser alterados." }, { status: 400 })
        }

        // Filtra apenas os itens que já existem no pedido e builda a mensagem de log
        const logLines: string[] = []
        const validUpdates = items.filter(update => {
            const originalItem = pedido.itens.find(item => Number(item.itemId) === update.itemId)
            if (originalItem && originalItem.quantidade !== update.quantidade) {
                logLines.push(`${originalItem.item.nome}: Quantidade alterada para ${update.quantidade} (Anterior: ${originalItem.quantidade})`)
                return true
            }
            return false
        })

        if (validUpdates.length === 0) {
            return NextResponse.json({ success: true, updatedCount: 0, message: "Nenhuma alteração detectada." })
        }

        // Executa as atualizações e o registro no histórico do cliente em uma transação
        const userId = session.user.id
        await prisma.$transaction([
            ...validUpdates.map(update =>
                prisma.pedidoItem.updateMany({
                    where: {
                        pedidoId: pedidoId,
                        itemId: BigInt(update.itemId)
                    },
                    data: {
                        quantidade: update.quantidade
                    }
                })
            ),
            prisma.clientRegistro.create({
                data: {
                    clientId: pedido.clienteId,
                    userId: userId,
                    mensagem: `[Pedido #${pedidoId}] Alteração de quantidades pelo técnico:\n${logLines.join("\n")}`
                }
            })
        ])

        return NextResponse.json({ success: true, updatedCount: validUpdates.length })
    } catch (error) {
        console.error("[pedidos/id/items/quantities][PATCH]", error)
        return NextResponse.json({ error: "Erro interno ao atualizar quantidades." }, { status: 500 })
    }
}
