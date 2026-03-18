import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import {
  createBrazilDateStart,
  createPeriodRange,
  getNowBrazil,
  type PeriodType,
} from "@/lib/date-utils"

type RouteParams = { params: Promise<{ id: string }> }

type ApuracaoRow = {
  fichaId: number
  cnpj: string
  razaoSocial: string
  clienteId: number | null
  apuradoEm: string
}

type ViewMode = "mes" | "semana" | "dia"

type ByDayRow = {
  date: string // YYYY-MM-DD (Brazil)
  label: string // DD/MM
  total: number
}

type ByWeekRow = {
  weekStart: string // YYYY-MM-DD (Brazil)
  label: string // DD/MM – DD/MM
  total: number
}

const safeInt = (value: string | null, fallback: number) => {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const pad2 = (n: number) => String(n).padStart(2, "0")

const toDateOnlyBR = (date: Date) => {
  // Uses local components from the Date instance (already anchored in -03:00)
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  return `${y}-${m}-${d}`
}

const formatBR = (date: Date) => `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`

const addDays = (date: Date, days: number) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

const startOfWeekMonday = (date: Date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=domingo ... 6=sábado
  const diff = day === 0 ? -6 : 1 - day // segunda como início
  d.setDate(d.getDate() + diff)
  return d
}

const clampRange = (start: Date, end: Date, clampStart: Date, clampEnd: Date) => {
  const s = start < clampStart ? clampStart : start
  const e = end > clampEnd ? clampEnd : end
  return { start: s, end: e }
}

/**
 * GET /api/pesquisadores/[id]/analise
 * Retorna os clientes/fichas "apuradas" por um pesquisador no período.
 *
 * Query params:
 * - periodo: "mes" (default) | "trimestre" | "semestre" | "ano" | "total"
 * - mes: 1-12 (default mês atual BR)
 * - ano: (default ano atual BR)
 * - tipo: "ENVIADO" | "RETORNADO" (default ENVIADO)
 * - view: "mes" | "semana" | "dia" (default mes)
 * - day: dia do mês (1-31) quando view=dia
 * - weekStart: YYYY-MM-DD (segunda-feira) quando view=semana
 * - page: paginação 1-based (default 1)
 * - pageSize: default 50
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: pesquisadorId } = await params

    const { searchParams } = new URL(request.url)
    const periodo = (searchParams.get("periodo") ?? "mes") as PeriodType
    const mesParam = searchParams.get("mes")
    const anoParam = searchParams.get("ano")
    const tipo = (searchParams.get("tipo") ?? "ENVIADO").toUpperCase()
    const logTipo = tipo === "RETORNADO" ? "RETORNADO" : "ENVIADO"
    const view = ((searchParams.get("view") ?? "mes") as ViewMode) || "mes"
    const dayParam = searchParams.get("day")
    const weekStartParam = searchParams.get("weekStart")
    const page = Math.max(1, safeInt(searchParams.get("page"), 1))
    const pageSize = Math.min(200, Math.max(1, safeInt(searchParams.get("pageSize"), 50)))

    const nowBrazil = getNowBrazil()
    const mesAtual = mesParam ? parseInt(mesParam, 10) : nowBrazil.month
    const anoAtual = anoParam ? parseInt(anoParam, 10) : nowBrazil.year

    const { startDate: monthStart, endDate: monthEnd } = createPeriodRange("mes", mesAtual, anoAtual)
    const { startDate: startDatePeriod, endDate: endDatePeriod } = createPeriodRange(periodo, mesAtual, anoAtual)

    const pesquisador = await prisma.user.findUnique({
      where: { id: pesquisadorId },
      select: { id: true, name: true, active: true },
    })

    if (!pesquisador) {
      return NextResponse.json({ error: "Pesquisador não encontrado" }, { status: 404 })
    }

    // Breakdown (mês): por dia (sempre retorna todos os dias do mês, incluindo zeros)
    const dayCounts = await prisma.$queryRaw<Array<{ dia: Date; total: bigint }>>`
      SELECT
        (fl."createdAt" AT TIME ZONE 'America/Sao_Paulo')::date as dia,
        COUNT(DISTINCT f.cnpj) as total
      FROM "FichaLog" fl
      INNER JOIN "Ficha" f ON f.id = fl."fichaId"
      WHERE fl.tipo::text = ${logTipo}
        AND fl."userId" = ${pesquisadorId}
        AND fl."createdAt" >= ${monthStart}
        AND fl."createdAt" < ${monthEnd}
      GROUP BY dia
      ORDER BY dia ASC
    `

    const byDayMap = new Map<string, number>()
    for (const row of dayCounts) {
      const key = toDateOnlyBR(new Date(row.dia))
      byDayMap.set(key, Number(row.total))
    }

    const firstDay = createBrazilDateStart(anoAtual, mesAtual, 1)
    const nextMonth = mesAtual === 12 ? { month: 1, year: anoAtual + 1 } : { month: mesAtual + 1, year: anoAtual }
    const endOfMonthExclusive = createBrazilDateStart(nextMonth.year, nextMonth.month, 1)
    const daysInMonth = Math.round((endOfMonthExclusive.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24))

    const byDay: ByDayRow[] = []
    for (let i = 0; i < daysInMonth; i++) {
      const d = addDays(firstDay, i)
      const key = toDateOnlyBR(d)
      byDay.push({
        date: key,
        label: formatBR(d),
        total: byDayMap.get(key) ?? 0,
      })
    }

    // Breakdown (mês): por semana (segunda–domingo), sempre retorna todas as semanas que intersectam o mês
    const weekCounts = await prisma.$queryRaw<Array<{ week_start: Date; total: bigint }>>`
      SELECT
        date_trunc('week', (fl."createdAt" AT TIME ZONE 'America/Sao_Paulo'))::date as week_start,
        COUNT(DISTINCT f.cnpj) as total
      FROM "FichaLog" fl
      INNER JOIN "Ficha" f ON f.id = fl."fichaId"
      WHERE fl.tipo::text = ${logTipo}
        AND fl."userId" = ${pesquisadorId}
        AND fl."createdAt" >= ${monthStart}
        AND fl."createdAt" < ${monthEnd}
      GROUP BY week_start
      ORDER BY week_start ASC
    `

    const byWeekMap = new Map<string, number>()
    for (const row of weekCounts) {
      const key = toDateOnlyBR(new Date(row.week_start))
      byWeekMap.set(key, Number(row.total))
    }

    const weeks: ByWeekRow[] = []
    let cursor = startOfWeekMonday(firstDay)
    while (cursor < endOfMonthExclusive) {
      const weekStart = cursor
      const weekEnd = addDays(weekStart, 7)
      const labelEnd = addDays(weekStart, 6)
      const key = toDateOnlyBR(weekStart)
      weeks.push({
        weekStart: key,
        label: `${formatBR(weekStart)} – ${formatBR(labelEnd)}`,
        total: byWeekMap.get(key) ?? 0,
      })
      cursor = weekEnd
    }

    // Range selecionado para a listagem (intersecta com o período pedido e com o view)
    let rangeStart = startDatePeriod
    let rangeEnd = endDatePeriod

    if (view === "dia") {
      const day = Math.max(1, Math.min(daysInMonth, safeInt(dayParam, nowBrazil.day)))
      const start = createBrazilDateStart(anoAtual, mesAtual, day)
      const end = addDays(start, 1)
      ;({ start: rangeStart, end: rangeEnd } = clampRange(start, end, rangeStart, rangeEnd))
    } else if (view === "semana" && weekStartParam) {
      const [y, m, d] = weekStartParam.split("-").map((n) => Number(n))
      const start = createBrazilDateStart(y, m, d)
      const end = addDays(start, 7)
      ;({ start: rangeStart, end: rangeEnd } = clampRange(start, end, rangeStart, rangeEnd))
      // garante que semana não "vaza" fora do mês selecionado (semanas do mês)
      ;({ start: rangeStart, end: rangeEnd } = clampRange(rangeStart, rangeEnd, monthStart, monthEnd))
    } else if (view === "mes") {
      ;({ start: rangeStart, end: rangeEnd } = clampRange(monthStart, monthEnd, rangeStart, rangeEnd))
    }

    const offset = (page - 1) * pageSize

    const totalResult = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(DISTINCT f.cnpj) as total
      FROM "FichaLog" fl
      INNER JOIN "Ficha" f ON f.id = fl."fichaId"
      WHERE fl.tipo::text = ${logTipo}
        AND fl."userId" = ${pesquisadorId}
        AND fl."createdAt" >= ${rangeStart}
        AND fl."createdAt" < ${rangeEnd}
    `

    const total = Number(totalResult[0]?.total ?? 0)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const rows = await prisma.$queryRaw<
      Array<{
        ficha_id: number
        cnpj: string
        razao_social: string | null
        cliente_id: number | null
        apurado_em: Date
      }>
    >`
      WITH base AS (
        SELECT DISTINCT ON (f.cnpj)
          fl."fichaId" as ficha_id,
          f.cnpj as cnpj,
          COALESCE(c."razaoSocial", f."razaoSocial") as razao_social,
          c.id as cliente_id,
          fl."createdAt" as apurado_em
        FROM "FichaLog" fl
        INNER JOIN "Ficha" f ON f.id = fl."fichaId"
        LEFT JOIN "Client" c ON c.cnpj = f.cnpj
        WHERE fl.tipo::text = ${logTipo}
          AND fl."userId" = ${pesquisadorId}
          AND fl."createdAt" >= ${rangeStart}
          AND fl."createdAt" < ${rangeEnd}
        ORDER BY f.cnpj, fl."createdAt" DESC
      )
      SELECT *
      FROM base
      ORDER BY apurado_em DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `

    const data: ApuracaoRow[] = rows.map((r) => ({
      fichaId: r.ficha_id,
      cnpj: r.cnpj,
      razaoSocial: r.razao_social ?? "",
      clienteId: r.cliente_id,
      apuradoEm: r.apurado_em.toISOString(),
    }))

    return NextResponse.json({
      pesquisador: { id: pesquisador.id, nome: pesquisador.name, active: pesquisador.active },
      periodo,
      mes: mesAtual,
      ano: anoAtual,
      tipo: logTipo,
      view,
      page,
      pageSize,
      total,
      totalPages,
      byDay,
      byWeek: weeks,
      data,
    })
  } catch (error) {
    console.error("[pesquisadores][analise][id][GET]", error)
    return NextResponse.json({ error: "Erro ao gerar análise do pesquisador" }, { status: 500 })
  }
}

