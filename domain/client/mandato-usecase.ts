import { Prisma, type PrismaClient, type ClientCategoria } from "@prisma/client"

export type MandatoCategoriaFiltro = ClientCategoria | "all"

export type MandatoDataStatus = "only_inicio" | "only_fim" | "ambos"

export type MandatosQuery = {
  year: number
  month?: number | null
  categoria?: MandatoCategoriaFiltro
  page?: number
  limit?: number
  status?: MandatoDataStatus
  sortBy?: "dataInicioMandato" | "dataFimMandato"
  sortOrder?: "asc" | "desc"
  dataInicioAte?: Date | null
  dataFimAte?: Date | null
}

export type MandatoRow = {
  id: number
  cnpj: string
  razaoSocial: string
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  categoria: ClientCategoria | null
  nomeSindico: string | null
  dataInicioMandato: Date | null
  dataFimMandato: Date | null
}

const categoriaEnumSqlMap: Record<ClientCategoria, Prisma.Sql> = {
  ATIVO: Prisma.sql`'ATIVO'::"ClientCategoria"`,
  AGENDADO: Prisma.sql`'AGENDADO'::"ClientCategoria"`,
  EXPLORADO: Prisma.sql`'EXPLORADO'::"ClientCategoria"`,
}

const buildMonthRange = (year: number, month?: number | null) => {
  if (month) {
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 1)
    return { start, end }
  }
  const start = new Date(year, 0, 1)
  const end = new Date(year + 1, 0, 1)
  return { start, end }
}

const buildPeriodCondition = (field: Prisma.Sql, year: number, month?: number | null) => {
  const { start, end } = buildMonthRange(year, month ?? null)
  return [
    Prisma.sql`${field} >= ${start}`,
    Prisma.sql`${field} < ${end}`,
  ]
}

const buildMandatosConditions = (
  query: MandatosQuery,
  now: Date,
  status: MandatoDataStatus,
  requireFuture: boolean
): Prisma.Sql[] => {
  const {
    year,
    month,
    categoria = "all",
    dataInicioAte,
    dataFimAte,
  } = query

  const conditions: Prisma.Sql[] = []

  if (status === "only_inicio") {
    conditions.push(
      Prisma.sql`c."dataInicioMandato" IS NOT NULL`,
      Prisma.sql`c."dataFimMandato" IS NULL`
    )
    if (dataInicioAte) {
      conditions.push(Prisma.sql`c."dataInicioMandato" <= ${dataInicioAte}`)
    }
    conditions.push(
      ...buildPeriodCondition(Prisma.sql`c."dataInicioMandato"`, year, month ?? null)
    )
  } else if (status === "only_fim") {
    conditions.push(
      Prisma.sql`c."dataFimMandato" IS NOT NULL`,
      Prisma.sql`c."dataInicioMandato" IS NULL`
    )
    if (dataFimAte) {
      conditions.push(Prisma.sql`c."dataFimMandato" <= ${dataFimAte}`)
    }
    if (requireFuture) {
      conditions.push(Prisma.sql`c."dataFimMandato" > ${now}`)
    }
    conditions.push(
      ...buildPeriodCondition(Prisma.sql`c."dataFimMandato"`, year, month ?? null)
    )
  } else {
    conditions.push(
      Prisma.sql`c."dataInicioMandato" IS NOT NULL`,
      Prisma.sql`c."dataFimMandato" IS NOT NULL`,
      Prisma.sql`c."dataFimMandato" > c."dataInicioMandato"`
    )
    if (dataInicioAte) {
      conditions.push(Prisma.sql`c."dataInicioMandato" <= ${dataInicioAte}`)
    }
    if (dataFimAte) {
      conditions.push(Prisma.sql`c."dataFimMandato" <= ${dataFimAte}`)
    }
    if (requireFuture) {
      conditions.push(Prisma.sql`c."dataFimMandato" > ${now}`)
    }
    conditions.push(
      ...buildPeriodCondition(Prisma.sql`c."dataFimMandato"`, year, month ?? null)
    )
  }

  if (categoria !== "all") {
    conditions.push(Prisma.sql`c."categoria" = ${categoriaEnumSqlMap[categoria]}`)
  }

  return conditions
}

const buildWhereClause = (conditions: Prisma.Sql[]) => {
  if (conditions.length === 0) {
    return Prisma.sql``
  }
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
}

export async function countMandatosVencendoNoMes(
  prisma: PrismaClient | Prisma.TransactionClient,
  now: Date = new Date()
): Promise<number> {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const conditions = buildMandatosConditions({ year, month, status: "ambos" }, now, "ambos", true)
  const whereClause = buildWhereClause(conditions)

  const result = await prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS total
    FROM "Client" c
    ${whereClause}
  `)

  return result[0]?.total ?? 0
}

export async function listMandatosVencendo(
  prisma: PrismaClient | Prisma.TransactionClient,
  query: MandatosQuery,
  now: Date = new Date()
): Promise<{ rows: MandatoRow[]; total: number }> {
  const {
    page = 1,
    limit = 50,
    status = "ambos",
    sortBy = "dataFimMandato",
    sortOrder = "asc",
  } = query
  const safeLimit = Math.min(Math.max(limit, 1), 200)
  const safePage = Math.max(page, 1)
  const offset = (safePage - 1) * safeLimit

  const conditions = buildMandatosConditions(query, now, status, false)
  const whereClause = buildWhereClause(conditions)
  const orderField =
    sortBy === "dataInicioMandato" ? Prisma.sql`c."dataInicioMandato"` : Prisma.sql`c."dataFimMandato"`
  const orderDirection = sortOrder === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`

  const [rows, totalResult] = await Promise.all([
    prisma.$queryRaw<MandatoRow[]>(Prisma.sql`
      SELECT
        c.id,
        c.cnpj,
        c."razaoSocial",
        c.logradouro,
        c.numero,
        c.complemento,
        c.bairro,
        c.cidade,
        c.estado,
        c.categoria,
        c."nomeSindico",
        c."dataInicioMandato",
        c."dataFimMandato"
      FROM "Client" c
      ${whereClause}
      ORDER BY ${orderField} ${orderDirection} NULLS LAST, c."razaoSocial" ASC
      LIMIT ${safeLimit}
      OFFSET ${offset}
    `),
    prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Client" c
      ${whereClause}
    `),
  ])

  return {
    rows,
    total: totalResult[0]?.total ?? 0,
  }
}

export async function getMandatosMonthlyCounts(
  prisma: PrismaClient | Prisma.TransactionClient,
  year: number,
  categoria: MandatoCategoriaFiltro = "all",
  status: MandatoDataStatus = "ambos",
  now: Date = new Date()
): Promise<Record<string, number>> {
  const conditions = buildMandatosConditions({ year, categoria }, now, status, false)
  const whereClause = buildWhereClause(conditions)
  const monthField =
    status === "only_inicio"
      ? Prisma.sql`c."dataInicioMandato"`
      : Prisma.sql`c."dataFimMandato"`

  const rows = await prisma.$queryRaw<Array<{ month: number; total: number }>>(Prisma.sql`
    SELECT EXTRACT(MONTH FROM ${monthField})::int AS month,
           COUNT(*)::int AS total
    FROM "Client" c
    ${whereClause}
    GROUP BY month
  `)

  const counts: Record<string, number> = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [
      String(index + 1).padStart(2, "0"),
      0,
    ])
  )

  for (const row of rows) {
    const key = String(row.month).padStart(2, "0")
    counts[key] = row.total
  }

  return counts
}

export async function getMandatosSummaryCountsGlobal(
  prisma: PrismaClient | Prisma.TransactionClient
): Promise<{
  semDados: number
  apenasInicio: number
  apenasFim: number
  ambos: number
}> {
  const [apenasInicio, apenasFim, ambos, semDados] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Client" c
      WHERE c."dataInicioMandato" IS NOT NULL
        AND c."dataFimMandato" IS NULL
    `),
    prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Client" c
      WHERE c."dataInicioMandato" IS NULL
        AND c."dataFimMandato" IS NOT NULL
    `),
    prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Client" c
      WHERE c."dataInicioMandato" IS NOT NULL
        AND c."dataFimMandato" IS NOT NULL
        AND c."dataFimMandato" > c."dataInicioMandato"
    `),
    prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Client" c
      WHERE c."dataInicioMandato" IS NULL
        AND c."dataFimMandato" IS NULL
    `),
  ])

  return {
    semDados: semDados[0]?.total ?? 0,
    apenasInicio: apenasInicio[0]?.total ?? 0,
    apenasFim: apenasFim[0]?.total ?? 0,
    ambos: ambos[0]?.total ?? 0,
  }
}
