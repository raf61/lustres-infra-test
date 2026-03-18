import { NextResponse } from "next/server"
import { Role } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  createBrazilDateStart,
  createPeriodRange,
  getNowBrazil,
  type PeriodType,
} from "@/lib/date-utils"

type PesquisadorResumo = {
  id: string
  nome: string
  totalFichas: number
}

type ByDayRow = {
  date: string // YYYY-MM-DD (Brazil)
  label: string // DD/MM
  total: number
}

type MonthEntry = {
  fichaId: number
  cnpj: string
  razaoSocial: string
  clienteId: number | null
  apuradoEm: string
  day: string // YYYY-MM-DD (Brazil)
  vendedorNome: string | null
}

const safeInt = (value: string | null, fallback: number) => {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const pad2 = (n: number) => String(n).padStart(2, "0")

const formatBR = (date: Date) => `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`

const toDateOnlyBR = (date: Date) => {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  return `${y}-${m}-${d}`
}

const addDays = (date: Date, days: number) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

async function buildMonthDetail(input: {
  pesquisadorId: string
  mes: number
  ano: number
  logTipo: "ENVIADO" | "RETORNADO"
}): Promise<{
  totalDistinctClients: number
  byDay: ByDayRow[]
  entries: MonthEntry[]
}> {
  const monthStart = createBrazilDateStart(input.ano, input.mes, 1)
  const nextMonth = input.mes === 12 ? { month: 1, year: input.ano + 1 } : { month: input.mes + 1, year: input.ano }
  const monthEnd = createBrazilDateStart(nextMonth.year, nextMonth.month, 1)
  const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24))

  const totalResult = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(DISTINCT f.cnpj) as total
    FROM "FichaLog" fl
    INNER JOIN "Ficha" f ON f.id = fl."fichaId"
    WHERE fl.tipo::text = ${input.logTipo}
      AND fl."userId" = ${input.pesquisadorId}
      AND fl."createdAt" >= ${monthStart}
      AND fl."createdAt" < ${monthEnd}
  `
  const totalDistinctClients = Number(totalResult[0]?.total ?? 0)

  const dayCounts = await prisma.$queryRaw<Array<{ dia: Date; total: bigint }>>`
    SELECT
      (fl."createdAt" AT TIME ZONE 'America/Sao_Paulo')::date as dia,
      COUNT(DISTINCT f.cnpj) as total
    FROM "FichaLog" fl
    INNER JOIN "Ficha" f ON f.id = fl."fichaId"
    WHERE fl.tipo::text = ${input.logTipo}
      AND fl."userId" = ${input.pesquisadorId}
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

  const byDay: ByDayRow[] = []
  for (let i = 0; i < daysInMonth; i++) {
    const d = addDays(monthStart, i)
    const key = toDateOnlyBR(d)
    byDay.push({ date: key, label: formatBR(d), total: byDayMap.get(key) ?? 0 })
  }

  // Distinct por (cnpj,dia) para permitir filtrar no calendário sem nova request
  const rows = await prisma.$queryRaw<
    Array<{
      ficha_id: number
      cnpj: string
      razao_social: string | null
      cliente_id: number | null
      apurado_em: Date
      dia: Date
      vendedor_nome: string | null
    }>
  >`
    SELECT DISTINCT ON (f.cnpj, (fl."createdAt" AT TIME ZONE 'America/Sao_Paulo')::date)
      fl."fichaId" as ficha_id,
      f.cnpj as cnpj,
      COALESCE(c."razaoSocial", f."razaoSocial") as razao_social,
      c.id as cliente_id,
      fl."createdAt" as apurado_em,
      (fl."createdAt" AT TIME ZONE 'America/Sao_Paulo')::date as dia,
      COALESCE(
        (SELECT u2.name FROM "FichaLog" fl2 INNER JOIN "User" u2 ON u2.id = fl2."userId" WHERE fl2."fichaId" = f.id AND fl2.tipo::text = 'RETORNADO' ORDER BY fl2."createdAt" DESC LIMIT 1),
        (SELECT u3.name FROM "User" u3 WHERE u3.id = c."vendedorId")
      ) as vendedor_nome
    FROM "FichaLog" fl
    INNER JOIN "Ficha" f ON f.id = fl."fichaId"
    LEFT JOIN "Client" c ON regexp_replace(c.cnpj, '[^0-9]', '', 'g') = regexp_replace(f.cnpj, '[^0-9]', '', 'g')
    WHERE fl.tipo::text = ${input.logTipo}
      AND fl."userId" = ${input.pesquisadorId}
      AND fl."createdAt" >= ${monthStart}
      AND fl."createdAt" < ${monthEnd}
    ORDER BY f.cnpj, dia, fl."createdAt" DESC
  `

  const entries: MonthEntry[] = rows
    .map((r) => ({
      fichaId: r.ficha_id,
      cnpj: r.cnpj,
      razaoSocial: r.razao_social ?? "",
      clienteId: r.cliente_id,
      apuradoEm: r.apurado_em.toISOString(),
      day: toDateOnlyBR(new Date(r.dia)),
      vendedorNome: r.vendedor_nome ?? null,
    }))
    .sort((a, b) => (a.apuradoEm < b.apuradoEm ? 1 : -1))

  return { totalDistinctClients, byDay, entries }
}

/**
 * GET /api/pesquisadores/analise
 * Retorna lista de pesquisadores com contagem de fichas "apuradas" no período.
 *
 * Por padrão considera o mês atual (Brasil) e o log de saída (ENVIADO).
 *
 * Query params:
 * - periodo: "mes" (default) | "trimestre" | "semestre" | "ano" | "total"
 * - mes: 1-12 (default mês atual BR)
 * - ano: (default ano atual BR)
 * - tipo: "ENVIADO" | "RETORNADO" (default ENVIADO)
 * - pesquisadorId: opcional. Se informado, retorna também o detalhamento do mês (calendário + entradas).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const periodo = (searchParams.get("periodo") ?? "mes") as PeriodType
    const mesParam = searchParams.get("mes")
    const anoParam = searchParams.get("ano")
    const tipo = (searchParams.get("tipo") ?? "ENVIADO").toUpperCase()
    const pesquisadorIdParam = searchParams.get("pesquisadorId")

    const logTipo = tipo === "RETORNADO" ? "RETORNADO" : "ENVIADO"

    const nowBrazil = getNowBrazil()
    const mesAtual = mesParam ? safeInt(mesParam, nowBrazil.month) : nowBrazil.month
    const anoAtual = anoParam ? safeInt(anoParam, nowBrazil.year) : nowBrazil.year

    const { startDate, endDate } = createPeriodRange(periodo, mesAtual, anoAtual)

    const pesquisadores = await prisma.user.findMany({
      where: { role: Role.PESQUISADOR, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })

    const rows = await prisma.$queryRaw<
      Array<{ user_id: string; total_fichas: bigint }>
    >`
      SELECT
        fl."userId" as user_id,
        COUNT(DISTINCT fl."fichaId") as total_fichas
      FROM "FichaLog" fl
      WHERE fl.tipo::text = ${logTipo}
        AND fl."createdAt" >= ${startDate}
        AND fl."createdAt" < ${endDate}
      GROUP BY fl."userId"
    `

    // Total global do período (evita double-count caso uma ficha apareça para mais de um user)
    const totalGlobalResult = await prisma.$queryRaw<Array<{ total_fichas: bigint }>>`
      SELECT COUNT(DISTINCT fl."fichaId") as total_fichas
      FROM "FichaLog" fl
      WHERE fl.tipo::text = ${logTipo}
        AND fl."createdAt" >= ${startDate}
        AND fl."createdAt" < ${endDate}
    `
    const totalFichasGlobal = Number(totalGlobalResult[0]?.total_fichas ?? 0)

    const statsMap = new Map<string, number>()
    for (const row of rows) {
      statsMap.set(row.user_id, Number(row.total_fichas))
    }

    const data: PesquisadorResumo[] = pesquisadores.map((p) => ({
      id: p.id,
      nome: p.name,
      totalFichas: statsMap.get(p.id) ?? 0,
    }))

    data.sort((a, b) => b.totalFichas - a.totalFichas)

    // Se não vier pesquisadorId, escolhe o primeiro (pra permitir 1 request só na tela)
    const resolvedPesquisadorId =
      pesquisadorIdParam && pesquisadores.some((p) => p.id === pesquisadorIdParam)
        ? pesquisadorIdParam
        : (pesquisadores[0]?.id ?? null)

    const detail =
      resolvedPesquisadorId && periodo === "mes"
        ? await buildMonthDetail({
          pesquisadorId: resolvedPesquisadorId,
          mes: mesAtual,
          ano: anoAtual,
          logTipo,
        })
        : null

    return NextResponse.json({
      data,
      totalFichasGlobal,
      periodo,
      mes: mesAtual,
      ano: anoAtual,
      tipo: logTipo,
      selectedPesquisadorId: resolvedPesquisadorId,
      ...(detail ? { detail } : {}),
    })
  } catch (error) {
    console.error("[pesquisadores][analise][GET]", error)
    return NextResponse.json({ error: "Erro ao gerar análise de pesquisadores" }, { status: 500 })
  }
}

