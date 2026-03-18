import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type RouteContext = {
    params: Promise<{
        id: string
    }>
}

export async function GET(
    request: Request,
    context: RouteContext
) {
    try {
        const { id: userId } = await context.params

        if (!userId) {
            return NextResponse.json({ error: "ID de usuário é obrigatório" }, { status: 400 })
        }

        const { searchParams } = new URL(request.url)
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
        const limit = Math.max(1, parseInt(searchParams.get("limit") || "100"))
        const skip = (page - 1) * limit

        const [total, comissoes] = await Promise.all([
            prisma.comissao.count({
                where: {
                    pedido: {
                        vendedorId: userId,
                    },
                },
            }),
            prisma.comissao.findMany({
                where: {
                    pedido: {
                        vendedorId: userId,
                    },
                },
                include: {
                    pedido: {
                        include: {
                            cliente: {
                                select: {
                                    id: true,
                                    razaoSocial: true,
                                },
                            },
                            itens: {
                                select: {
                                    quantidade: true,
                                    valorUnitarioPraticado: true,
                                },
                            },
                        },
                    },
                    contaPagar: {
                        select: {
                            id: true,
                            status: true,
                            vencimento: true,
                            pagoEm: true,
                        },
                    },
                },
                orderBy: { vencimento: "desc" },
                skip,
                take: limit,
            })
        ])

        const data = comissoes.map((c) => {
            // Pedido total calculation
            const totalPedido = c.pedido.itens.reduce(
                (acc, item) => acc + item.quantidade * item.valorUnitarioPraticado,
                0
            )

            return {
                id: c.id,
                vencimento: c.vencimento,
                cliente: c.pedido.cliente.razaoSocial,
                clienteId: c.pedido.cliente.id,
                pedidoId: c.pedidoId,
                totalPedido,
                valorComissao: c.valor,
                status: c.contaPagar?.status ?? 0,
                contaPagarId: c.contaPagar?.id,
                pagoEm: c.contaPagar?.pagoEm,
            }
        })

        return NextResponse.json({
            data,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        })
    } catch (error) {
        console.error("[COMISSOES_GET]", error)
        return NextResponse.json({ error: "Erro ao buscar comissões" }, { status: 500 })
    }
}
