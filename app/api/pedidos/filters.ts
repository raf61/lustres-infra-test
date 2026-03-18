import { Prisma, PedidoStatus } from "@prisma/client"
import { createBrazilDateStart, createPeriodRange, type PeriodType } from "@/lib/date-utils"

const ACCENTED_CHARS = "ÁÀÃÂÄáàãâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÕÔÖóòõôöÚÙÛÜúùûüÇçÑñ"
const UNACCENTED_CHARS = "AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn"

export type PedidoStatusFiltro = keyof typeof PedidoStatus

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

export const normalizeStatusParam = (value: string | null): PedidoStatusFiltro | null => {
  if (!value) return null
  const normalized = value.toUpperCase()
  if (Object.keys(PedidoStatus).includes(normalized)) {
    return normalized as PedidoStatusFiltro
  }
  return null
}

// Pre-built SQL fragments for enum casting
export const statusEnumSqlMap: Record<PedidoStatusFiltro, Prisma.Sql> = {
  AGUARDANDO: Prisma.sql`'AGUARDANDO'::"PedidoStatus"`,
  AGENDADO: Prisma.sql`'AGENDADO'::"PedidoStatus"`,
  EXECUCAO: Prisma.sql`'EXECUCAO'::"PedidoStatus"`,
  CONCLUIDO: Prisma.sql`'CONCLUIDO'::"PedidoStatus"`,
  CANCELADO: Prisma.sql`'CANCELADO'::"PedidoStatus"`,
  SAC: Prisma.sql`'SAC'::"PedidoStatus"`,
  AGUARDANDO_APROVACAO_SUPERVISAO: Prisma.sql`'AGUARDANDO_APROVACAO_SUPERVISAO'::"PedidoStatus"`,
  AGUARDANDO_APROVACAO_FINAL: Prisma.sql`'AGUARDANDO_APROVACAO_FINAL'::"PedidoStatus"`,
  ANALISE_CANCELAMENTO: Prisma.sql`'ANALISE_CANCELAMENTO'::"PedidoStatus"`,
  ANALISE_CANCELAMENTO_SUPERVISAO: Prisma.sql`'ANALISE_CANCELAMENTO_SUPERVISAO'::"PedidoStatus"`,
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
export const buildPedidoBaseConditions = (params: URLSearchParams): Prisma.Sql[] => {
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

  // Nome/Razão Social (do cliente) OU ID do pedido
  const search = sanitizeText(params.get("search"))
  if (search) {
    // Caso o usuário digite #123, limpamos o # para pesquisar pelo ID numérico
    const cleanSearch = search.replace(/^#/, "")
    const searchAsNumber = Number.parseInt(cleanSearch, 10)
    const pattern = `%${escapeLikePattern(normalizeForComparison(search))}%`

    if (!Number.isNaN(searchAsNumber) && /^\d+$/.test(cleanSearch)) {
      // Se for um número válido, pesquisa por razão social OU pelo ID exato do pedido
      conditions.push(
        Prisma.sql`(${normalizeColumn(Prisma.sql`coalesce(c."razaoSocial", '')`)} LIKE ${pattern} ESCAPE '\\' OR p.id = ${searchAsNumber})`,
      )
    } else {
      // Caso contrário, mantém a busca apenas por razão social
      conditions.push(buildLikeCondition(Prisma.sql`coalesce(c."razaoSocial", '')`, pattern))
    }
  }

  // Vendedor (suporta "none" para sem vendedor)
  const vendedorId = sanitizeText(params.get("vendedorId"))
  if (vendedorId && vendedorId !== "all") {
    if (vendedorId === "none") {
      conditions.push(Prisma.sql`p."vendedorId" IS NULL`)
    } else {
      conditions.push(Prisma.sql`p."vendedorId" = ${vendedorId}`)
    }
  }

  // Empresa (via Orcamento - empresaId está no Orcamento, não no Pedido)
  // Nota: As queries devem incluir JOIN com Orcamento para usar este filtro
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
export const buildPedidoWhereConditions = (params: URLSearchParams): Prisma.Sql[] => {
  const conditions = buildPedidoBaseConditions(params)

  // Status do pedido
  const status = normalizeStatusParam(params.get("status"))
  if (status) {
    conditions.push(Prisma.sql`p."status" = ${statusEnumSqlMap[status]}`)
  }

  return conditions
}

export const buildPedidoDateConditions = (params: URLSearchParams): Prisma.Sql[] => {
  const conditions: Prisma.Sql[] = []

  const periodoParam = params.get("periodo")
  const year = toYearNumber(params.get("year"))
  const month = toMonthNumber(params.get("month"))
  const dayParam = params.get("day")
  const day = dayParam ? parseInt(dayParam, 10) : 1

  // Determinar o tipo de período
  let period: PeriodType = "ano"
  if (periodoParam) {
    period = periodoParam as PeriodType
  } else if (month !== null) {
    period = "mes"
  } else if (year !== null) {
    period = "ano"
  } else {
    // Se não há filtro de período, usamos o ano atual como default se não for total
    if (periodoParam === "total") {
      period = "total"
    } else {
      return [] // Sem filtro de data
    }
  }

  // Se year for null mas precisamos dele, usamos o atual
  const finalYear = year ?? new Date().getFullYear()
  const finalMonth = month ?? 1

  const { startDate, endDate } = createPeriodRange(period, finalMonth, finalYear, day)

  conditions.push(Prisma.sql`p."createdAt" >= ${startDate}`)
  conditions.push(Prisma.sql`p."createdAt" < ${endDate}`)

  return conditions
}

export const buildWhereClause = (conditions: Prisma.Sql[]) => {
  if (conditions.length === 0) {
    return Prisma.sql``
  }
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
}

