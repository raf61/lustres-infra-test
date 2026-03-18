import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const PAGE_SIZE = 30

type ActiveClientRow = {
  id: number
  cnpj: string
  razaoSocial: string
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  ultimaManutencao: Date | null
  categoria: string | null
}

const toMonthNumber = (value: string | null): number | null => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 12) return null
  return parsed
}

const toYearNumber = (value: string | null): number | null => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 2000 || parsed > 2100) return null
  return parsed
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const monthNumber = toMonthNumber(searchParams.get("month"))
    const yearNumber = toYearNumber(searchParams.get("year"))
    const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10)
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam
    const offset = (page - 1) * PAGE_SIZE

    const selectedYear = yearNumber ?? new Date().getFullYear()
    const startOfMonth = monthNumber === null ? null : new Date(selectedYear, monthNumber - 1, 1)
    const endOfMonth = monthNumber === null ? null : new Date(selectedYear, monthNumber, 1)

    // Filtrar pela próxima manutenção (última manutenção + 1 ano)
    // Se selecionar 2025, mostrar clientes cuja última manutenção foi em 2024 e renovarão em 2025
    const monthCondition =
      monthNumber === null
        ? Prisma.sql``
        : Prisma.sql`
            AND c."ultimaManutencao" IS NOT NULL
            AND (c."ultimaManutencao" + interval '1 year')
            BETWEEN ${startOfMonth} AND ${endOfMonth}
          `

    const totalResult = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total
      FROM "Client" c
      WHERE c."categoria" = 'ATIVO'
      ${monthCondition}
    `
    const total = totalResult.at(0)?.total ?? 0

    const leads = await prisma.$queryRaw<ActiveClientRow[]>`
      SELECT
        c."id",
        c."cnpj",
        c."razaoSocial",
        c."logradouro",
        c."numero",
        c."complemento",
        c."bairro",
        c."cidade",
        c."estado",
        c."ultimaManutencao",
        c."categoria"
      FROM "Client" c
      WHERE c."categoria" = 'ATIVO'
      ${monthCondition}
      ORDER BY c."ultimaManutencao" ASC NULLS LAST, c."razaoSocial" ASC
      OFFSET ${offset}
      LIMIT ${PAGE_SIZE}
    `

    return NextResponse.json({
      data: leads,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        hasNextPage: offset + leads.length < total,
      },
    })
  } catch (error) {
    console.error("Erro ao buscar leads ativos:", error)
    return NextResponse.json(
      { error: "Erro ao buscar leads ativos" },
      { status: 500 }
    )
  }
}

