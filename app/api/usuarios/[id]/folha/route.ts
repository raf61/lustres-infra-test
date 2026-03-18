import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type RouteContext = {
    params: Promise<{
        id: string
    }>
}

export async function GET(request: Request, context: RouteContext) {
    try {
        const { id: userId } = await context.params
        const { searchParams } = new URL(request.url)

        const mes = Number.parseInt(searchParams.get("mes") || String(new Date().getMonth() + 1))
        const ano = Number.parseInt(searchParams.get("ano") || String(new Date().getFullYear()))

        if (!userId) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 })

        // Build date range for the month (matching legacy a.Data logic)
        const startDate = new Date(ano, mes - 1, 1, 0, 0, 0)
        const endDate = new Date(ano, mes, 1, 0, 0, 0)

        // 1. Fetch Lancamentos (matching legacy a.Data logic)
        const lancamentos = await prisma.userLancamento.findMany({
            where: {
                userId,
                data: {
                    gte: startDate,
                    lt: endDate,
                },
            },
            orderBy: { data: "asc" },
        })

        // 2. Fetch Paid Commissions (matching legacy: a.Pago and reference date in month)
        const comissoesRaw = await prisma.comissao.findMany({
            where: {
                pedido: {
                    vendedorId: userId,
                },
                createdAt: {
                    gte: startDate,
                    lt: endDate,
                },
                contaPagar: {
                    status: 1, // 1 = PAGO
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
                    },
                },
            },
            orderBy: { createdAt: "asc" },
        })

        // 3. Fetch User Info (to show on header)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, fullname: true },
        })

        const data = {
            user: {
                nome: user?.fullname || user?.name || "Usuário",
            },
            comissoes: comissoesRaw.map((c) => ({
                id: c.id,
                valor: c.valor,
                cliente: c.pedido.cliente.razaoSocial,
                clienteId: c.pedido.cliente.id,
                pedidoId: c.pedidoId,
            })),
            lancamentos: lancamentos.map((l) => ({
                id: l.id,
                descricao: l.descricao,
                valor: l.valor ?? 0,
                tipo: l.tipo, // "Receita" ou "Despesa"
            })),
        }

        return NextResponse.json({ data })
    } catch (error) {
        console.error("[api/usuarios/folha]", error)
        return NextResponse.json({ error: "Erro ao gerar folha" }, { status: 500 })
    }
}
