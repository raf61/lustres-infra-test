import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { PedidoStatus, Prisma } from "@prisma/client"
import { startOfYear, endOfYear, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter } from "date-fns"

const STATUS_VALIDOS: PedidoStatus[] = [
    PedidoStatus.AGUARDANDO,
    PedidoStatus.AGENDADO,
    PedidoStatus.EXECUCAO,
    PedidoStatus.CONCLUIDO,
    PedidoStatus.SAC,
    PedidoStatus.AGUARDANDO_APROVACAO_SUPERVISAO,
    PedidoStatus.AGUARDANDO_APROVACAO_FINAL,
    PedidoStatus.ANALISE_CANCELAMENTO,
    PedidoStatus.ANALISE_CANCELAMENTO_SUPERVISAO,
]

const PEDIDO_STATUS_VALIDOS_SQL = Prisma.sql`ARRAY[${Prisma.join(STATUS_VALIDOS.map(s => Prisma.sql`${s}::"PedidoStatus"`))}]`

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get("type") // "lost", "new", "repeat", "orders", "budgets_no_sale", "budgets_all"
        const ano = searchParams.get("ano") ? parseInt(searchParams.get("ano")!) : new Date().getFullYear()
        const mes = searchParams.get("mes") ? parseInt(searchParams.get("mes")!) : null
        const targetMonth = searchParams.get("targetMonth") ? parseInt(searchParams.get("targetMonth")!) : null
        const trimestre = searchParams.get("trimestre") ? parseInt(searchParams.get("trimestre")!) : null
        const estado = searchParams.get("estado") && searchParams.get("estado") !== "todos" ? searchParams.get("estado")! : null
        const vendedorId = searchParams.get("vendedorId") && searchParams.get("vendedorId") !== "todos" ? searchParams.get("vendedorId")! : null
        const periodicity = searchParams.get("periodicity") || "ano"
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "50")
        const skip = (page - 1) * limit

        const yearStart = startOfYear(new Date(ano, 0))
        const yearEnd = endOfYear(new Date(ano, 0))

        // Determinar o range de datas operacional (Faturamento, Orçamentos, Novos Clientes)
        let rangeStart: Date
        let rangeEnd: Date

        if (targetMonth) {
            rangeStart = startOfMonth(new Date(ano, targetMonth - 1))
            rangeEnd = endOfMonth(new Date(ano, targetMonth - 1))
        } else if (periodicity === "mes" && mes) {
            rangeStart = startOfMonth(new Date(ano, mes - 1))
            rangeEnd = endOfMonth(new Date(ano, mes - 1))
        } else if (periodicity === "trimestre" && trimestre) {
            const m = (trimestre - 1) * 3
            rangeStart = startOfQuarter(new Date(ano, m))
            rangeEnd = endOfQuarter(new Date(ano, m))
        } else {
            rangeStart = periodicity === "todos" ? new Date(2000, 0, 1) : yearStart
            rangeEnd = periodicity === "todos" ? new Date(2099, 11, 31) : yearEnd
        }

        let results: any[] = []
        let total = 0

        if (type === "lost") {
            const prevYearStart = subMonths(yearStart, 12)
            const prevYearEnd = subMonths(yearEnd, 12)

            // Critério de mês para o Churn: 
            // Se houver targetMonth, usa ele. Se não e for periodicity 'mes', usa o global 'mes'.
            const activeMonthFilter = targetMonth || (periodicity === "mes" ? mes : null)
            const monthClause = activeMonthFilter ? Prisma.sql`AND EXTRACT(MONTH FROM p."createdAt") = ${activeMonthFilter}` : Prisma.empty

            results = await prisma.$queryRaw<any[]>`
                SELECT DISTINCT ON (c.id)
                    c.id, c."razaoSocial", c.cnpj, c.estado, c.cidade, c."ultimaManutencao",
                    EXTRACT(MONTH FROM p."createdAt")::int as "expectedMonth"
                FROM "Client" c
                JOIN "Pedido" p ON p."clienteId" = c.id
                WHERE p."createdAt" >= ${prevYearStart} AND p."createdAt" <= ${prevYearEnd}
                AND p.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
                ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
                ${vendedorId ? Prisma.sql`AND p."vendedorId" = ${vendedorId}` : Prisma.empty}
                ${monthClause}
                
                -- Não ter pedido no ano alvo para ser considerado perdido de vez
                AND c.id NOT IN (
                    SELECT DISTINCT p2."clienteId" FROM "Pedido" p2 
                    WHERE p2."createdAt" >= ${yearStart} AND p2."createdAt" <= ${yearEnd}
                    AND p2.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
                )
                -- Tolerância de 3 meses para não punir renovações levemente atrasadas ou adiantadas
                AND c.id NOT IN (
                    SELECT DISTINCT p3."clienteId" FROM "Pedido" p3
                    WHERE p3."createdAt" >= (p."createdAt" + interval '9 months')
                      AND p3."createdAt" <= (p."createdAt" + interval '15 months')
                      AND p3.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
                )
                ORDER BY c.id, p."createdAt" DESC
                LIMIT ${limit} OFFSET ${skip}
            `

            const countR = await prisma.$queryRaw<{ count: number }[]>`
                SELECT COUNT(DISTINCT c.id)::int as count
                FROM "Client" c
                JOIN "Pedido" p ON p."clienteId" = c.id
                WHERE p."createdAt" >= ${prevYearStart} AND p."createdAt" <= ${prevYearEnd}
                AND p.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
                ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
                ${vendedorId ? Prisma.sql`AND p."vendedorId" = ${vendedorId}` : Prisma.empty}
                ${monthClause}
                AND c.id NOT IN (
                    SELECT DISTINCT p2."clienteId" FROM "Pedido" p2 WHERE p2."createdAt" >= ${yearStart} AND p2."createdAt" <= ${yearEnd}
                )
                AND c.id NOT IN (
                    SELECT DISTINCT p3."clienteId" FROM "Pedido" p3 
                    WHERE p3."createdAt" >= (p."createdAt" + interval '9 months') AND p3."createdAt" <= (p."createdAt" + interval '15 months')
                )
            `
            total = countR[0]?.count || 0
        }
        else if (type === "new" || type === "repeat") {
            const isNew = type === "new"

            const where: any = {
                AND: [
                    {
                        pedidos: {
                            some: {
                                createdAt: { gte: rangeStart, lte: rangeEnd },
                                status: { in: STATUS_VALIDOS }
                            }
                        }
                    },
                    {
                        pedidos: isNew ? {
                            none: {
                                createdAt: { lt: yearStart },
                                status: { in: STATUS_VALIDOS }
                            }
                        } : {
                            some: {
                                createdAt: { lt: yearStart },
                                status: { in: STATUS_VALIDOS }
                            }
                        }
                    }
                ],
                ...(estado ? { estado } : {}),
                ...(vendedorId ? { vendedorId } : {})
            }

            total = await prisma.client.count({ where })
            results = await prisma.client.findMany({
                where,
                skip,
                take: limit,
                select: { id: true, razaoSocial: true, cnpj: true, estado: true, cidade: true, ultimaManutencao: true },
                orderBy: { razaoSocial: 'asc' }
            })

            results = results.map(c => ({
                ...c,
                eventMonth: targetMonth || (c.ultimaManutencao ? new Date(c.ultimaManutencao).getMonth() + 1 : (mes || 1))
            }))
        }
        else if (type === "orders" || type === "budgets_no_sale" || type === "budgets_all") {
            if (type === "orders") {
                const where: any = {
                    createdAt: { gte: rangeStart, lte: rangeEnd },
                    status: { in: STATUS_VALIDOS },
                    ...(estado ? { cliente: { estado } } : {}),
                    ...(vendedorId ? { vendedorId } : {})
                }
                total = await prisma.pedido.count({ where })
                results = await prisma.pedido.findMany({
                    where, skip, take: limit,
                    include: {
                        cliente: { select: { razaoSocial: true, estado: true } },
                        itens: { select: { valorUnitarioPraticado: true, quantidade: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                })
            } else {
                const where: any = {
                    createdAt: { gte: rangeStart, lte: rangeEnd },
                    ...(type === "budgets_no_sale" ? { pedido: null } : {}),
                    ...(estado ? { cliente: { estado } } : {}),
                    ...(vendedorId ? { vendedorId } : {})
                }
                total = await prisma.orcamento.count({ where })
                results = await prisma.orcamento.findMany({
                    where, skip, take: limit,
                    include: {
                        cliente: { select: { razaoSocial: true, estado: true } },
                        itens: { select: { valor: true, quantidade: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                })
            }
        }

        // =========================================================================
        // CALCULAR CONTAGENS POR MÊS (PARA OS BOTÕES)
        // =========================================================================
        let monthCounts: Record<number, number> = {}

        if (type === "orders") {
            const counts = await prisma.$queryRaw<{ month: number; count: number }[]>`
                SELECT EXTRACT(MONTH FROM "createdAt")::int as month, COUNT(*)::int as count
                FROM "Pedido"
                WHERE "createdAt" >= ${yearStart} AND "createdAt" <= ${yearEnd}
                AND status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
                ${estado ? Prisma.sql`AND "clienteId" IN (SELECT id FROM "Client" WHERE estado = ${estado})` : Prisma.empty}
                ${vendedorId ? Prisma.sql`AND "vendedorId" = ${vendedorId}` : Prisma.empty}
                GROUP BY month
            `
            counts.forEach(c => monthCounts[c.month] = c.count)
        }
        else if (type === "budgets_all" || type === "budgets_no_sale") {
            const counts = await prisma.$queryRaw<{ month: number; count: number }[]>`
                SELECT EXTRACT(MONTH FROM "createdAt")::int as month, COUNT(*)::int as count
                FROM "Orcamento"
                WHERE "createdAt" >= ${yearStart} AND "createdAt" <= ${yearEnd}
                ${type === "budgets_no_sale" ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM "Pedido" p WHERE p."orcamentoId" = "Orcamento".id)` : Prisma.empty}
                ${estado ? Prisma.sql`AND "clienteId" IN (SELECT id FROM "Client" WHERE estado = ${estado})` : Prisma.empty}
                ${vendedorId ? Prisma.sql`AND "vendedorId" = ${vendedorId}` : Prisma.empty}
                GROUP BY month
            `
            counts.forEach(c => monthCounts[c.month] = c.count)
        }
        else if (type === "lost") {
            const prevYearStart = subMonths(yearStart, 12)
            const prevYearEnd = subMonths(yearEnd, 12)
            const counts = await prisma.$queryRaw<{ month: number; count: number }[]>`
                SELECT EXTRACT(MONTH FROM p."createdAt")::int as month, COUNT(DISTINCT p."clienteId")::int as count
                FROM "Pedido" p
                JOIN "Client" c ON c.id = p."clienteId"
                WHERE p."createdAt" >= ${prevYearStart} AND p."createdAt" <= ${prevYearEnd}
                AND p.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
                ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
                ${vendedorId ? Prisma.sql`AND p."vendedorId" = ${vendedorId}` : Prisma.empty}
                AND p."clienteId" NOT IN (SELECT p2."clienteId" FROM "Pedido" p2 WHERE p2."createdAt" >= ${yearStart} AND p2."createdAt" <= ${yearEnd})
                AND p."clienteId" NOT IN (SELECT p3."clienteId" FROM "Pedido" p3 WHERE p3."createdAt" >= (p."createdAt" + interval '9 months') AND p3."createdAt" <= (p."createdAt" + interval '15 months'))
                GROUP BY month
            `
            counts.forEach(c => monthCounts[c.month] = c.count)
        }
        else if (type === "new" || type === "repeat") {
            const isNew = type === "new"
            const counts = await prisma.$queryRaw<{ month: number; count: number }[]>`
                SELECT EXTRACT(MONTH FROM p."createdAt")::int as month, COUNT(DISTINCT p."clienteId")::int as count
                FROM "Pedido" p
                JOIN "Client" c ON c.id = p."clienteId"
                WHERE p."createdAt" >= ${yearStart} AND p."createdAt" <= ${yearEnd}
                AND p.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
                ${estado ? Prisma.sql`AND c.estado = ${estado}` : Prisma.empty}
                ${vendedorId ? Prisma.sql`AND c."vendedorId" = ${vendedorId}` : Prisma.empty}
                AND p."clienteId" ${isNew ? Prisma.sql`NOT IN` : Prisma.sql`IN`} (
                    SELECT p2."clienteId" FROM "Pedido" p2 WHERE p2."createdAt" < ${yearStart} AND p2.status = ANY(${PEDIDO_STATUS_VALIDOS_SQL})
                )
                GROUP BY month
            `
            counts.forEach(c => monthCounts[c.month] = c.count)
        }

        return NextResponse.json({
            results,
            monthCounts,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        })

    } catch (error) {
        console.error("Erro ao carregar detalhes:", error)
        return NextResponse.json({ error: "Erro interno" }, { status: 500 })
    }
}
