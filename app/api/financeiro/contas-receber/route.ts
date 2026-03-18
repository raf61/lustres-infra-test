import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getNowBrazil, createBrazilDate, createBrazilDateStart, parseDateOnlySafe } from "@/lib/date-utils"

const PAGE_SIZE_DEFAULT = 30
const MAX_PAGE_SIZE = 100

type StatusFiltro = "todos" | "a_receber" | "recebido" | "vencido" | "cancelado"

const getCurrentMonthRange = () => {
  const { year, month } = getNowBrazil()
  const start = createBrazilDateStart(year, month, 1)
  // Último dia do mês: dia 1 do próximo mês
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const end = createBrazilDateStart(nextYear, nextMonth, 1)
  return { start, end }
}

const parseDate = (value?: string | null) => {
  if (!value) return undefined
  const date = parseDateOnlySafe(value)
  return date ?? undefined
}

const parsePage = (value?: string | null) => {
  const page = Number(value || 1)
  if (!page || Number.isNaN(page) || page < 1) return 1
  return page
}

const parsePageSize = (value?: string | null) => {
  const size = Number(value || PAGE_SIZE_DEFAULT)
  if (!size || Number.isNaN(size) || size < 1) return PAGE_SIZE_DEFAULT
  return Math.min(size, MAX_PAGE_SIZE)
}

const buildWhere = (params: {
  status: StatusFiltro
  vendedorId?: string
  empresaId?: number
  startDate?: Date
  endDate?: Date
  occurrenceStart?: Date
  occurrenceEnd?: Date
  search?: string
}) => {
  const where: Prisma.DebitoWhereInput = {}
  const and: Prisma.DebitoWhereInput[] = []

  // Lógica igual ao legado:
  // - stats = 0: A receber (pendente)
  // - stats = 2: Recebido/Baixado
  // - stats = -1: Cancelado
  // - "Vencido" = stats === 0 E vencimento < hoje (calculado, não armazenado)
  const { year, month, day } = getNowBrazil()
  const hoje = createBrazilDate(year, month, day)

  // Monta filtro de vencimento combinando status + período
  const vencimentoFilter: { gte?: Date; lte?: Date; lt?: Date } = {}

  if (params.status === "a_receber") {
    // A receber = pendente com vencimento >= hoje
    where.stats = 0
    vencimentoFilter.gte = hoje
  } else if (params.status === "recebido") {
    where.stats = 2
  } else if (params.status === "vencido") {
    // Vencido = stats === 0 (pendente) E vencimento < hoje
    where.stats = 0
    vencimentoFilter.lt = hoje
  } else if (params.status === "cancelado") {
    where.stats = -1
  }

  // Combina com filtro de período (não sobrescreve o filtro de status)
  if (params.startDate) {
    // Se já tem gte do status, usa o maior (mais restritivo)
    if (vencimentoFilter.gte) {
      vencimentoFilter.gte = params.startDate.getTime() > vencimentoFilter.gte.getTime()
        ? params.startDate
        : vencimentoFilter.gte
    } else {
      vencimentoFilter.gte = params.startDate
    }
  }
  if (params.endDate) {
    // Se já tem lt do status (vencido), usa o menor (mais restritivo)
    if (vencimentoFilter.lt) {
      vencimentoFilter.lt = params.endDate.getTime() < vencimentoFilter.lt.getTime()
        ? params.endDate
        : vencimentoFilter.lt
    } else {
      vencimentoFilter.lte = params.endDate
    }
  }

  // Aplica filtro de vencimento se houver algum critério
  if (Object.keys(vencimentoFilter).length > 0) {
    where.vencimento = vencimentoFilter
  }

  if (params.occurrenceStart || params.occurrenceEnd) {
    where.dataOcorrencia = {
      ...(params.occurrenceStart ? { gte: params.occurrenceStart } : {}),
      ...(params.occurrenceEnd ? { lte: params.occurrenceEnd } : {}),
    }
  }

  if (params.vendedorId) {
    and.push({ pedido: { vendedorId: params.vendedorId } })
  }

  if (params.empresaId) {
    and.push({ pedido: { orcamento: { empresaId: params.empresaId } } })
  }

  // Pesquisa por número do débito, número do pedido ou razão social do cliente
  if (params.search?.trim()) {
    const searchTerm = params.search.trim()

    // Se for apenas números, pesquisa por ID do débito ou ID do pedido
    if (/^\d+$/.test(searchTerm)) {
      const searchId = parseInt(searchTerm, 10)
      and.push({
        OR: [
          { id: searchId },
          { pedidoId: searchId },
        ]
      })
    } else {
      // Pesquisa por razão social do cliente (case-insensitive)
      and.push({
        cliente: {
          razaoSocial: { contains: searchTerm, mode: "insensitive" }
        }
      })
    }
  }

  if (and.length) {
    where.AND = and
  }

  return where
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const statusParam = (url.searchParams.get("status") || "todos") as StatusFiltro
  const vendedorId = url.searchParams.get("vendedorId") || undefined
  const empresaId = url.searchParams.get("empresaId")
  const startDate = parseDate(url.searchParams.get("startDate") || url.searchParams.get("start"))
  const endDate = parseDate(url.searchParams.get("endDate") || url.searchParams.get("end"))
  const occurrenceStart = parseDate(url.searchParams.get("occurrenceStart"))
  const occurrenceEnd = parseDate(url.searchParams.get("occurrenceEnd"))
  const search = url.searchParams.get("search") || undefined
  const page = parsePage(url.searchParams.get("page"))
  const pageSize = parsePageSize(url.searchParams.get("pageSize"))

  const where = buildWhere({
    status: statusParam,
    vendedorId,
    empresaId: empresaId ? Number(empresaId) : undefined,
    startDate,
    endDate,
    occurrenceStart,
    occurrenceEnd,
    search,
  })
  const { start: monthStart, end: monthEnd } = getCurrentMonthRange()

  try {
    const [debitos, total, aggregate, grouped, abertoGeral, abertoMes, recebidoMes, recebidoAtrasoMes] = await prisma.$transaction([
      prisma.debito.findMany({
        where,
        include: {
          cliente: { select: { razaoSocial: true, estado: true } },
          pedido: {
            select: {
              vendedorId: true,
              vendedor: { select: { name: true } },
              bancoEmissorId: true,
              orcamento: { select: { empresaId: true, empresa: { select: { nome: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.debito.count({ where }),
      prisma.debito.aggregate({ where, _sum: { receber: true } }),
      prisma.debito.groupBy({
        by: ["stats"],
        _sum: { receber: true },
        _count: { _all: true },
        where,
        orderBy: { stats: "asc" },
      }),
      // Aberto geral = apenas stats = 0 (pendentes, não cancelados)
      prisma.debito.aggregate({
        where: { stats: 0 },
        _sum: { receber: true },
        _count: true,
      }),
      prisma.debito.aggregate({
        where: { stats: 0, vencimento: { gte: monthStart, lt: monthEnd } },
        _sum: { receber: true },
        _count: true,
      }),
      // Total recebido esse mês (status = 2 e dataOcorrencia no mês atual)
      prisma.debito.aggregate({
        where: { stats: 2, dataOcorrencia: { gte: monthStart, lt: monthEnd } },
        _sum: { receber: true },
        _count: true,
      }),
      // Total pago em atraso no mês (dataOcorrencia no mês e vencimento < dataOcorrencia)
      prisma.$queryRaw<Array<{ total: number; count: bigint }>>`
        SELECT
          COALESCE(SUM(d."receber"), 0) as total,
          COUNT(*) as count
        FROM "Debito" d
        WHERE d."stats" = 2
          AND d."dataOcorrencia" >= ${monthStart}
          AND d."dataOcorrencia" < ${monthEnd}
          AND d."vencimento" < d."dataOcorrencia"
      `,
    ])

    // Calcular totais por status (igual ao legado: vencido = stats 0 + vencimento < hoje)
    const nowBr = getNowBrazil()
    const hojeCalc = createBrazilDate(nowBr.year, nowBr.month, nowBr.day)

    const [aReceberAgg, vencidoAgg, recebidoAgg, canceladoAgg] = await prisma.$transaction([
      // A receber = stats 0 E vencimento >= hoje
      prisma.debito.aggregate({
        where: { stats: 0, vencimento: { gte: hojeCalc } },
        _sum: { receber: true },
        _count: true,
      }),
      // Vencido = stats 0 E vencimento < hoje
      prisma.debito.aggregate({
        where: { stats: 0, vencimento: { lt: hojeCalc } },
        _sum: { receber: true },
        _count: true,
      }),
      // Recebido = stats 2
      prisma.debito.aggregate({
        where: { stats: 2 },
        _sum: { receber: true },
        _count: true,
      }),
      // Cancelado = stats -1
      prisma.debito.aggregate({
        where: { stats: -1 },
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

    const data = debitos.map((debito) => ({
      id: debito.id,
      valor: debito.receber ?? 0,
      vencimento: debito.vencimento?.toISOString() ?? null,
      dataOcorrencia: debito.dataOcorrencia?.toISOString() ?? null,
      stats: debito.stats ?? 0,
      clienteId: debito.clienteId,
      cliente: debito.cliente?.razaoSocial ?? "Cliente não identificado",
      estado: debito.cliente?.estado ?? "",
      vendedor: debito.pedido?.vendedor?.name ?? "",
      vendedorId: debito.pedido?.vendedorId ?? null,
      empresa: debito.pedido?.orcamento?.empresa?.nome ?? null,
      empresaId: debito.pedido?.orcamento?.empresaId ?? null,
      bancoEmissorId: debito.pedido?.bancoEmissorId ?? null,
    }))

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages },
      summary: {
        filteredTotal: aggregate._sum.receber || 0,
        statusTotals,
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
    })
  } catch (error) {
    console.error("[financeiro][contas-receber][GET]", error)
    return NextResponse.json({ error: "Erro ao listar contas a receber." }, { status: 500 })
  }
}

