import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { normalizeColumn } from "@/app/api/fichas/route"

// Helpers (mantêm a mesma interpretação de filtros da listagem)
const ACCENTED_CHARS = "ÁÀÃÂÄáàãâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÕÔÖóòõôöÚÙÛÜúùûüÇçÑñ"
const UNACCENTED_CHARS = "AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn"

const normalizeForComparison = (value: string) =>
  value
    .normalize("NFD")
    .replace(new RegExp(`[${ACCENTED_CHARS}]`, "g"), (match) => {
      const index = ACCENTED_CHARS.indexOf(match)
      return index >= 0 ? UNACCENTED_CHARS[index] : match
    })
    .toLowerCase()
    .trim()

const escapeLikePattern = (value: string) => value.replace(/[%_\\]/g, "\\$&")

const sanitizeText = (value: string | null) => (value ?? "").trim()
const sanitizeDigits = (value: string | null) => (value ?? "").replace(/\D/g, "")

const buildLikeCondition = (column: Prisma.Sql, pattern: string) =>
  Prisma.sql`${normalizeColumn(column)} LIKE ${pattern} ESCAPE '\\'`

const buildWhereConditionsFromFilters = (filters: {
  search?: string
  cnpj?: string
  bairro?: string
  estado?: string
  cidade?: string
  semPesquisador?: boolean
  pesquisadorId?: string
}) => {
  const conditions: Prisma.Sql[] = []

  // apenas fichas em pesquisa
  conditions.push(Prisma.sql`f."fichaStatus" = 'EM_PESQUISA'`)

  const cnpj = sanitizeDigits(filters.cnpj ?? null)
  if (cnpj.length > 0) {
    const cnpjConditions = [
      Prisma.sql`regexp_replace(coalesce(f."cnpj", ''), '\\D', '', 'g') = ${cnpj}`,
      Prisma.sql`f."cnpj" ILIKE ${cnpj}`,
    ]
    if (cnpj.length === 14) {
      const formatted = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      cnpjConditions.push(Prisma.sql`f."cnpj" ILIKE ${formatted}`)
    }
    conditions.push(Prisma.sql`(${Prisma.join(cnpjConditions, " OR ")})`)
  }

  const searchTerm = sanitizeText(filters.search ?? null)
  const normalizedSearch = normalizeForComparison(searchTerm)
  if (normalizedSearch.length > 0) {
    const pattern = `%${escapeLikePattern(normalizedSearch)}%`
    const searchableColumns = [
      Prisma.sql`coalesce(f."razaoSocial", '')`,
      Prisma.sql`coalesce(f."logradouro", '')`,
      Prisma.sql`coalesce(f."cidade", '')`,
      Prisma.sql`coalesce(f."bairro", '')`,
      Prisma.sql`coalesce(f."estado", '')`,
    ]
    const orFilters = searchableColumns.map((column) => buildLikeCondition(column, pattern))
    const numericSearch = searchTerm.replace(/\D/g, "")
    if (numericSearch.length >= 3) {
      orFilters.push(Prisma.sql`regexp_replace(coalesce(f."cnpj", ''), '\\D', '', 'g') ILIKE ${`%${numericSearch}%`}`)
    }
    conditions.push(Prisma.sql`(${Prisma.join(orFilters, " OR ")})`)
  }

  const estado = sanitizeText(filters.estado ?? null)
  if (estado && estado !== "all") {
    conditions.push(Prisma.sql`${normalizeColumn(Prisma.sql`coalesce(f."estado", '')`)} = ${normalizeForComparison(estado)}`)
  }

  const cidade = sanitizeText(filters.cidade ?? null)
  if (cidade && cidade !== "all") {
    conditions.push(Prisma.sql`${normalizeColumn(Prisma.sql`coalesce(f."cidade", '')`)} = ${normalizeForComparison(cidade)}`)
  }

  const bairro = sanitizeText(filters.bairro ?? null)
  if (bairro && bairro !== "all") {
    conditions.push(Prisma.sql`${normalizeColumn(Prisma.sql`coalesce(f."bairro", '')`)} = ${normalizeForComparison(bairro)}`)
  }

  if (filters.semPesquisador) {
    conditions.push(Prisma.sql`f."pesquisadorId" IS NULL`)
  }

  const pesquisadorId = sanitizeText(filters.pesquisadorId ?? null)
  if (pesquisadorId && pesquisadorId !== "all") {
    conditions.push(Prisma.sql`f."pesquisadorId" = ${pesquisadorId}`)
  }

  return conditions
}

const buildWhereClause = (conditions: Prisma.Sql[]) =>
  conditions.length === 0 ? Prisma.sql`` : Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`

type AssignBody =
  | {
      mode: "ids"
      pesquisadorId: string
      ids: number[]
    }
  | {
      mode: "filter"
      pesquisadorId: string
      filters: {
        search?: string
        cnpj?: string
        bairro?: string
        estado?: string
        cidade?: string
        semPesquisador?: boolean
      }
      excludeIds?: number[]
    }

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AssignBody
    console.log(body)
    if (!body?.pesquisadorId) {
      return NextResponse.json({ error: "pesquisadorId é obrigatório" }, { status: 400 })
    }

    const pesquisador = await prisma.user.findUnique({ where: { id: body.pesquisadorId } })
    if (!pesquisador || pesquisador.role !== "PESQUISADOR") {
      return NextResponse.json({ error: "pesquisadorId inválido ou usuário não é PESQUISADOR" }, { status: 400 })
    }

    if (body.mode === "ids") {
      if (!Array.isArray(body.ids) || body.ids.length === 0) {
        return NextResponse.json({ error: "ids obrigatórios no modo ids" }, { status: 400 })
      }

      const { count } = await prisma.ficha.updateMany({
        where: { id: { in: body.ids } },
        data: { pesquisadorId: body.pesquisadorId },
      })

      return NextResponse.json({ updated: count, mode: "ids" })
    }

    if (body.mode === "filter") {
      const conditions = buildWhereConditionsFromFilters(body.filters || {})
      const whereClause = buildWhereClause(conditions)
      const excludeIds = Array.isArray(body.excludeIds) ? body.excludeIds : []

      const excludeClause =
        excludeIds.length > 0 ? Prisma.sql`AND f.id NOT IN (${Prisma.join(excludeIds, ",")})` : Prisma.sql``

      const updateQuery = Prisma.sql`
        UPDATE "Ficha" f
        SET "pesquisadorId" = ${body.pesquisadorId}
        ${whereClause}
        ${excludeClause}
      `

      const result = await prisma.$executeRawUnsafe<number>(updateQuery.text, ...updateQuery.values)
      
      return NextResponse.json({
        updated: result,
        mode: "filter",
        excludeCount: excludeIds.length,
      })
    }

    return NextResponse.json({ error: "mode inválido" }, { status: 400 })
  } catch (error) {
    console.error("[fichas][atribuir-pesquisador][POST]", error)
    return NextResponse.json({ error: "Erro ao atribuir pesquisador" }, { status: 500 })
  }
}

