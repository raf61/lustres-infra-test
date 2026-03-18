import { NextResponse } from "next/server"
import type { ClientCategoria } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  getMandatosSummaryCountsGlobal,
  getMandatosMonthlyCounts,
  listMandatosVencendo,
  type MandatoCategoriaFiltro,
  type MandatoDataStatus,
} from "@/domain/client/mandato-usecase"

const parseYear = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10)
  if (Number.isNaN(parsed) || parsed < 2000 || parsed > 2100) return fallback
  return parsed
}

const parseMonth = (value: string | null): number | null => {
  if (!value || value === "all") return null
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 12) return null
  return parsed
}

const parseCategoria = (value: string | null): MandatoCategoriaFiltro => {
  if (!value || value === "all") return "all"
  const upper = value.toUpperCase()
  if (upper === "ATIVO" || upper === "AGENDADO" || upper === "EXPLORADO") {
    return upper as ClientCategoria
  }
  return "all"
}

const parseStatus = (value: string | null): MandatoDataStatus => {
  if (!value) return "ambos"
  if (value === "only_inicio" || value === "only_fim" || value === "ambos") {
    return value
  }
  return "ambos"
}

const parsePage = (value: string | null) => {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed
}

const parseLimit = (value: string | null) => {
  const parsed = Number.parseInt(value ?? "", 10)
  if (Number.isNaN(parsed) || parsed < 1) return 50
  return Math.min(parsed, 200)
}

const parseDate = (value: string | null): Date | null => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const now = new Date()

    const year = parseYear(searchParams.get("year"), now.getFullYear())
    const month = parseMonth(searchParams.get("month"))
    const categoria = parseCategoria(searchParams.get("categoria"))
    const status = parseStatus(searchParams.get("status"))
    const page = parsePage(searchParams.get("page"))
    const limit = parseLimit(searchParams.get("limit"))
    const sortBy =
      searchParams.get("sortBy") === "dataInicioMandato"
        ? "dataInicioMandato"
        : "dataFimMandato"
    const sortOrder =
      searchParams.get("sortOrder") === "desc" ? "desc" : "asc"
    const dataInicioAte = parseDate(searchParams.get("dataInicioAte"))
    const dataFimAte = parseDate(searchParams.get("dataFimAte"))

    const baseQuery = {
      year,
      month,
      categoria,
      status,
      page,
      limit,
      sortBy,
      sortOrder,
      dataInicioAte,
      dataFimAte,
    } as const

    const [{ rows, total }, monthlyCounts, summary] = await Promise.all([
      listMandatosVencendo(
        prisma,
        baseQuery,
        now
      ),
      getMandatosMonthlyCounts(prisma, year, categoria, status, now),
      getMandatosSummaryCountsGlobal(prisma),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))

    return NextResponse.json({
      data: rows.map((row) => ({
        ...row,
        dataInicioMandato: row.dataInicioMandato ? row.dataInicioMandato.toISOString() : null,
        dataFimMandato: row.dataFimMandato ? row.dataFimMandato.toISOString() : null,
      })),
      pagination: {
        page,
        pageSize: limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
      },
      monthlyCounts,
      summary,
      filters: {
        year,
        month,
        categoria,
        status,
        sortBy,
        sortOrder,
        dataInicioAte,
        dataFimAte,
      },
    })
  } catch (error) {
    console.error("[mandatos][GET] Error:", error)
    return NextResponse.json({ error: "Erro ao buscar mandatos" }, { status: 500 })
  }
}
