import { Prisma } from "@prisma/client"

const ACCENTED_CHARS = "ÁÀÃÂÄáàãâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÕÔÖóòõôöÚÙÛÜúùûüÇçÑñ"
const UNACCENTED_CHARS = "AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn"

export type OrcamentoStatusFiltro = "EM_ABERTO" | "APROVADO" | "REPROVADO" | "CANCELADO"

export const toMonthNumber = (value: string | null): number | null => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 12) return null
  return parsed
}

export const toYearNumber = (value: string | null): number | null => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 2000 || parsed > 2100) return null
  return parsed
}

export const normalizeStatusParam = (value: string | null): OrcamentoStatusFiltro | null => {
  if (!value) return null
  const normalized = value.toUpperCase()
  if (
    normalized === "EM_ABERTO" ||
    normalized === "APROVADO" ||
    normalized === "REPROVADO" ||
    normalized === "CANCELADO"
  ) {
    return normalized as OrcamentoStatusFiltro
  }
  return null
}

// Pre-built SQL fragments for enum casting (same pattern as clients/filters.ts)
export const statusEnumSqlMap: Record<OrcamentoStatusFiltro, Prisma.Sql> = {
  EM_ABERTO: Prisma.sql`'EM_ABERTO'::"OrcamentoStatus"`,
  APROVADO: Prisma.sql`'APROVADO'::"OrcamentoStatus"`,
  REPROVADO: Prisma.sql`'REPROVADO'::"OrcamentoStatus"`,
  CANCELADO: Prisma.sql`'CANCELADO'::"OrcamentoStatus"`,
}

const sanitizeText = (value: string | null) => value?.trim() ?? ""

const normalizeForComparison = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

const escapeLikePattern = (value: string) => value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")

const normalizeColumn = (column: Prisma.Sql) =>
  Prisma.sql`translate(lower(${column}), ${ACCENTED_CHARS}, ${UNACCENTED_CHARS})`

const buildLikeCondition = (column: Prisma.Sql, pattern: string) =>
  Prisma.sql`${normalizeColumn(column)} LIKE ${pattern} ESCAPE '\\'`

// Build conditions WITHOUT status filter (for status breakdown stats)
export const buildOrcamentoBaseConditions = (params: URLSearchParams): Prisma.Sql[] => {
  const conditions: Prisma.Sql[] = []

  // Estado (do cliente)
  const estado = sanitizeText(params.get("estado"))
  if (estado && estado !== "all") {
    conditions.push(
      Prisma.sql`${normalizeColumn(Prisma.sql`coalesce(c."estado", '')`)} = ${normalizeForComparison(estado)}`,
    )
  }

  // Cidade (do cliente)
  const cidade = sanitizeText(params.get("cidade"))
  if (cidade && cidade !== "all") {
    conditions.push(
      Prisma.sql`${normalizeColumn(Prisma.sql`coalesce(c."cidade", '')`)} = ${normalizeForComparison(cidade)}`,
    )
  }

  // Bairro (do cliente)
  const bairro = sanitizeText(params.get("bairro"))
  if (bairro && bairro !== "all" && bairro.length > 0) {
    const pattern = `%${escapeLikePattern(normalizeForComparison(bairro))}%`
    conditions.push(buildLikeCondition(Prisma.sql`coalesce(c."bairro", '')`, pattern))
  }

  // Nome/Razão Social (do cliente)
  const search = sanitizeText(params.get("search"))
  if (search) {
    const pattern = `%${escapeLikePattern(normalizeForComparison(search))}%`
    conditions.push(buildLikeCondition(Prisma.sql`coalesce(c."razaoSocial", '')`, pattern))
  }

  // Vendedor
  const vendedorId = sanitizeText(params.get("vendedorId"))
  if (vendedorId && vendedorId !== "all") {
    conditions.push(Prisma.sql`o."vendedorId" = ${vendedorId}`)
  }

  // Empresa
  const empresaId = sanitizeText(params.get("empresaId"))
  if (empresaId && empresaId !== "all") {
    const empresaIdNum = Number.parseInt(empresaId, 10)
    if (!Number.isNaN(empresaIdNum)) {
      conditions.push(Prisma.sql`o."empresaId" = ${empresaIdNum}`)
    }
  }

  return conditions
}

// Build ALL conditions including status filter (for data listing and filtered totals)
export const buildOrcamentoWhereConditions = (params: URLSearchParams): Prisma.Sql[] => {
  const conditions = buildOrcamentoBaseConditions(params)

  // Status do orçamento
  const status = normalizeStatusParam(params.get("status"))
  if (status) {
    conditions.push(Prisma.sql`o."status" = ${statusEnumSqlMap[status]}`)
  }

  return conditions
}

export const buildOrcamentoDateConditions = (params: URLSearchParams): Prisma.Sql[] => {
  const conditions: Prisma.Sql[] = []

  const year = toYearNumber(params.get("year"))
  const month = toMonthNumber(params.get("month"))

  // Year is required
  if (year !== null) {
    if (month !== null) {
      // Filter by specific month and year
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
      const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))
      conditions.push(Prisma.sql`o."createdAt" >= ${startDate}`)
      conditions.push(Prisma.sql`o."createdAt" < ${endDate}`)
    } else {
      // Filter by entire year
      const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
      const endDate = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0))
      conditions.push(Prisma.sql`o."createdAt" >= ${startDate}`)
      conditions.push(Prisma.sql`o."createdAt" < ${endDate}`)
    }
  }

  return conditions
}

export const buildWhereClause = (conditions: Prisma.Sql[]) => {
  if (conditions.length === 0) {
    return Prisma.sql``
  }
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
}

