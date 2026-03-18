import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getNowBrazil, createBrazilDate, createBrazilDateStart } from "@/lib/date-utils"

export type StatusFiltro = "todos" | "a_receber" | "recebido" | "vencido" | "cancelado"

export interface CobrancaFilter {
    status: StatusFiltro
    vendedorId?: string
    empresaId?: number
    startDate?: Date
    endDate?: Date
    occurrenceStart?: Date
    occurrenceEnd?: Date
    search?: string
    clientPage: number
    clientPageSize: number
    clientLimit?: number
    order: "asc" | "desc"
}

export class GetDebitoCobrancaUseCase {
    async execute(params: CobrancaFilter) {
        const where = this.buildWhere(params)
        const { start: monthStart, end: monthEnd } = this.getCurrentMonthRange()

        const [aggregate, abertoGeral, abertoMes, recebidoMes, recebidoAtrasoMes] = await prisma.$transaction([
            prisma.debito.aggregate({ where, _sum: { receber: true } }),
            prisma.debito.aggregate({
                where: { stats: 0, AND: this.getBaseWhere(params) },
                _sum: { receber: true },
                _count: true,
            }),
            prisma.debito.aggregate({
                where: { stats: 0, vencimento: { gte: monthStart, lte: monthEnd }, AND: this.getBaseWhere(params) },
                _sum: { receber: true },
                _count: true,
            }),
            prisma.debito.aggregate({
                where: { stats: 2, dataOcorrencia: { gte: monthStart, lte: monthEnd }, AND: this.getBaseWhere(params) },
                _sum: { receber: true },
                _count: true,
            }),
            params.vendedorId
                ? prisma.$queryRaw<Array<{ total: number; count: bigint }>>`
                SELECT
                  COALESCE(SUM(d."receber"), 0) as total,
                  COUNT(*) as count
                FROM "Debito" d
                INNER JOIN "Pedido" p ON d."pedidoId" = p."id"
                WHERE d."stats" = 2
                  AND d."dataOcorrencia" >= ${monthStart}
                  AND d."dataOcorrencia" <= ${monthEnd}
                  AND d."vencimento" < d."dataOcorrencia"
                  AND p."vendedorId" = ${params.vendedorId}
              `
                : prisma.$queryRaw<Array<{ total: number; count: bigint }>>`
                SELECT
                  COALESCE(SUM(d."receber"), 0) as total,
                  COUNT(*) as count
                FROM "Debito" d
                WHERE d."stats" = 2
                  AND d."dataOcorrencia" >= ${monthStart}
                  AND d."dataOcorrencia" <= ${monthEnd}
                  AND d."vencimento" < d."dataOcorrencia"
              `,
        ])

        const nowBr = getNowBrazil()
        const hojeCalc = createBrazilDate(nowBr.year, nowBr.month, nowBr.day)

        const [aReceberAgg, vencidoAgg, recebidoAgg, canceladoAgg] = await prisma.$transaction([
            prisma.debito.aggregate({
                where: { stats: 0, vencimento: { gte: hojeCalc }, AND: this.getBaseWhere(params) },
                _sum: { receber: true },
                _count: true,
            }),
            prisma.debito.aggregate({
                where: { stats: 0, vencimento: { lt: hojeCalc }, AND: this.getBaseWhere(params) },
                _sum: { receber: true },
                _count: true,
            }),
            prisma.debito.aggregate({
                where: { stats: 2, AND: this.getBaseWhere(params) },
                _sum: { receber: true },
                _count: true,
            }),
            prisma.debito.aggregate({
                where: { stats: -1, AND: this.getBaseWhere(params) },
                _sum: { receber: true },
                _count: true,
            }),
        ])

        const statusTotals = {
            aReceber: { total: aReceberAgg._sum.receber ?? 0, count: aReceberAgg._count ?? 0 },
            vencido: { total: vencidoAgg._sum.receber ?? 0, count: vencidoAgg._count ?? 0 },
            recebido: { total: recebidoAgg._sum.receber ?? 0, count: recebidoAgg._count ?? 0 },
            cancelado: { total: canceladoAgg._sum.receber ?? 0, count: canceladoAgg._count ?? 0 },
        }

        const debitosGrouped = await prisma.debito.findMany({
            where,
            include: {
                cliente: {
                    select: {
                        id: true,
                        razaoSocial: true,
                        cnpj: true,
                        estado: true,
                        nomeSindico: true,
                        telefoneSindico: true,
                        telefoneCondominio: true,
                        celularCondominio: true,
                    },
                },
            },
            orderBy: { vencimento: params.order },
        })

        const debitoIds = debitosGrouped.map((debito) => debito.id)
        const cobrancaCounts = debitoIds.length
            ? await prisma.cobrancaCampanhaEnvio.groupBy({
                by: ["debitoId"],
                _count: { _all: true },
                where: {
                    debitoId: { in: debitoIds },
                    status: { in: ["SENT"] },
                },
            })
            : ([] as Array<{ debitoId: number; _count: { _all: number } }>)

        const cobrancaMap = new Map<number, number>(
            cobrancaCounts.map((entry) => [entry.debitoId, entry._count._all])
        )

        const clientMap = new Map<number, any>()

        for (const debito of debitosGrouped) {
            const clienteId = debito.clienteId
            const clienteInfo = {
                id: clienteId,
                razaoSocial: debito.cliente?.razaoSocial ?? "Cliente não identificado",
                cnpj: debito.cliente?.cnpj ?? "",
                estado: debito.cliente?.estado ?? null,
                nomeSindico: debito.cliente?.nomeSindico ?? null,
                telefoneSindico: debito.cliente?.telefoneSindico ?? null,
                telefoneCondominio: debito.cliente?.telefoneCondominio ?? null,
                celularCondominio: debito.cliente?.celularCondominio ?? null,
            }
            if (!clientMap.has(clienteId)) {
                clientMap.set(clienteId, { info: clienteInfo, debitos: [] })
            }
            clientMap.get(clienteId)?.debitos.push({
                id: debito.id,
                valor: debito.receber ?? 0,
                vencimento: debito.vencimento?.toISOString() ?? null,
                stats: debito.stats ?? 0,
                cobrancasCount: cobrancaMap.get(debito.id) ?? 0,
                boletoDisponivel: Boolean(debito.linkBoleto),
            })
        }

        let clients = Array.from(clientMap.values()).map((client) => {
            const timestamps = client.debitos
                .map((d: any) => (d.vencimento ? new Date(d.vencimento).getTime() : null))
                .filter((v: any): v is number => v !== null)
            const sortKey = timestamps.length > 0 ? (params.order === "asc" ? Math.min(...timestamps) : Math.max(...timestamps)) : 0
            return { ...client, sortKey }
        })

        clients.sort((a, b) => (params.order === "asc" ? a.sortKey - b.sortKey : b.sortKey - a.sortKey))

        const totalClientsAll = clients.length
        if (params.clientLimit && params.clientLimit > 0) {
            clients = clients.slice(0, params.clientLimit)
        }

        const totalClients = clients.length
        const effectivePageSize = params.clientLimit && params.clientLimit > 0 ? params.clientLimit : params.clientPageSize
        const totalPages = Math.max(1, Math.ceil(totalClients / effectivePageSize))
        const start = (params.clientPage - 1) * effectivePageSize
        const end = start + effectivePageSize
        const pageClients = clients.slice(start, end).map(({ sortKey, ...rest }) => rest)

        return {
            clients: pageClients,
            pagination: { page: params.clientPage, pageSize: effectivePageSize, total: totalClients, totalPages },
            totalClientes: totalClientsAll,
            summary: {
                filteredTotal: aggregate._sum.receber || 0,
                statusTotals,
                inadimplencia: {
                    total: statusTotals.vencido.total,
                    count: statusTotals.vencido.count,
                },
                pagoAtrasoMes: {
                    total: Number(recebidoAtrasoMes?.[0]?.total ?? 0),
                    count: Number(recebidoAtrasoMes?.[0]?.count ?? 0),
                },
                abertoGeral: {
                    total: abertoGeral._sum.receber || 0,
                    count: abertoGeral._count ?? 0,
                },
                abertoMesAtual: {
                    total: abertoMes._sum.receber || 0,
                    count: abertoMes._count ?? 0,
                },
                recebidoMesAtual: {
                    total: recebidoMes._sum.receber || 0,
                    count: recebidoMes._count ?? 0,
                },
            },
        }
    }

    private getBaseWhere(params: CobrancaFilter): Prisma.DebitoWhereInput[] {
        const and: Prisma.DebitoWhereInput[] = []
        if (params.vendedorId) {
            and.push({ pedido: { vendedorId: params.vendedorId } })
        }
        if (params.empresaId) {
            and.push({ pedido: { orcamento: { empresaId: params.empresaId } } })
        }
        if (params.search?.trim()) {
            const searchTerm = params.search.trim()
            const searchId = parseInt(searchTerm, 10)
            if (!Number.isNaN(searchId) && searchId > 0) {
                and.push({ id: searchId })
            } else {
                and.push({ cliente: { razaoSocial: { contains: searchTerm, mode: "insensitive" } } })
            }
        }
        return and
    }

    private buildWhere(params: CobrancaFilter) {
        const where: Prisma.DebitoWhereInput = {}
        const and = this.getBaseWhere(params)

        const { year, month, day } = getNowBrazil()
        const hoje = createBrazilDate(year, month, day)

        const vencimentoFilter: { gte?: Date; lte?: Date; lt?: Date } = {}

        if (params.status === "a_receber") {
            where.stats = 0
            vencimentoFilter.gte = hoje
        } else if (params.status === "recebido") {
            where.stats = 2
        } else if (params.status === "vencido") {
            where.stats = 0
            vencimentoFilter.lt = hoje
        } else if (params.status === "cancelado") {
            where.stats = -1
        }

        if (params.startDate) {
            if (vencimentoFilter.gte) {
                vencimentoFilter.gte =
                    params.startDate.getTime() > vencimentoFilter.gte.getTime() ? params.startDate : vencimentoFilter.gte
            } else {
                vencimentoFilter.gte = params.startDate
            }
        }
        if (params.endDate) {
            if (vencimentoFilter.lt) {
                vencimentoFilter.lt =
                    params.endDate.getTime() < vencimentoFilter.lt.getTime() ? params.endDate : vencimentoFilter.lt
            } else {
                vencimentoFilter.lte = params.endDate
            }
        }

        if (Object.keys(vencimentoFilter).length > 0) {
            where.vencimento = vencimentoFilter
        }

        if (params.occurrenceStart || params.occurrenceEnd) {
            where.dataOcorrencia = {
                ...(params.occurrenceStart ? { gte: params.occurrenceStart } : {}),
                ...(params.occurrenceEnd ? { lte: params.occurrenceEnd } : {}),
            }
        }

        if (and.length) {
            where.AND = and
        }

        return where
    }

    private getCurrentMonthRange() {
        const { year, month } = getNowBrazil()
        const start = createBrazilDateStart(year, month, 1)
        const nextMonth = month === 12 ? 1 : month + 1
        const nextYear = month === 12 ? year + 1 : year
        const end = createBrazilDateStart(nextYear, nextMonth, 1)
        return { start, end }
    }
}
