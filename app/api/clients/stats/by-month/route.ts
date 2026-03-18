import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { buildWhereClause, buildWhereConditions, buildBudgetConditions, categoriaEnumSqlMap } from "@/app/api/clients/filters"

type Categoria = "ativo" | "agendado" | "perdida"

const toYearNumber = (value: string | null): number | null => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 2000 || parsed > 2100) return null
  return parsed
}

const padMonth = (month: number) => String(month).padStart(2, "0")

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const categoria = (searchParams.get("categoria") ?? "") as Categoria
    if (categoria !== "ativo" && categoria !== "agendado" && categoria !== "perdida") {
      return NextResponse.json({ error: "categoria inválida (use ativo|agendado|perdida)" }, { status: 400 })
    }

    const year = toYearNumber(searchParams.get("year"))
    if (!year) {
      return NextResponse.json({ error: "year inválido" }, { status: 400 })
    }

    const baseConditions = buildWhereConditions(searchParams)
    const budgetConditions = buildBudgetConditions(searchParams)
    const combinedBase = [...baseConditions, ...budgetConditions]

    const where = (() => {
      if (categoria === "ativo") {
        return buildWhereClause([...combinedBase, Prisma.sql`c."categoria" = ${categoriaEnumSqlMap.ativo}`])
      }
      if (categoria === "agendado") {
        return buildWhereClause([...combinedBase, Prisma.sql`c."categoria" = ${categoriaEnumSqlMap.agendado}`])
      }
      // perdida
      return buildWhereClause([
        ...combinedBase,
        Prisma.sql`(c."categoria" IS NULL OR c."categoria" != ${categoriaEnumSqlMap.ativo})`,
      ])
    })()

    const windowCondition = (() => {
      if (categoria === "ativo") {
        return Prisma.sql`
          c."ultimaManutencao" IS NOT NULL
          AND (c."ultimaManutencao" + interval '1 year') >= make_date((${year})::int, (months.month)::int, 1)
          AND (c."ultimaManutencao" + interval '1 year') < (make_date((${year})::int, (months.month)::int, 1) + interval '1 month')
        `
      }

      if (categoria === "agendado") {
        return Prisma.sql`
          c."ultimaManutencao" IS NOT NULL
          AND c."ultimaManutencao" >= make_date((${year - 1})::int, (months.month)::int, 1)
          AND c."ultimaManutencao" < (make_date((${year - 1})::int, (months.month)::int, 1) + interval '1 month')
        `
      }

      // perdida (mesmo critério do buildCategoryConditions)
      // - não é ATIVO
      // - teve pedido no mesmo mês do ano anterior
      // - NÃO teve pedido num raio de +/- 2 meses do mês alvo no ano selecionado
      const baseStart = Prisma.sql`make_date((${year - 1})::int, (months.month)::int, 1)`
      const baseEnd = Prisma.sql`(${baseStart} + interval '1 month')`
      const windowStart = Prisma.sql`(make_date((${year})::int, (months.month)::int, 1) - interval '2 months')`
      const windowEnd = Prisma.sql`(make_date((${year})::int, (months.month)::int, 1) + interval '3 months')`

      return Prisma.sql`
        EXISTS (
          SELECT 1 FROM "Pedido" p
          WHERE p."clienteId" = c.id
          AND p."createdAt" >= ${baseStart} AND p."createdAt" < ${baseEnd}
          AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
        )
        AND NOT EXISTS (
          SELECT 1 FROM "Pedido" p
          WHERE p."clienteId" = c.id
          AND p."createdAt" >= ${windowStart} AND p."createdAt" < ${windowEnd}
          AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
        )
      `
    })()

    const rows = await prisma.$queryRaw<{ month: number; total: number }[]>(Prisma.sql`
      WITH months AS (SELECT generate_series(1, 12) AS month)
      SELECT months.month, COUNT(*)::int AS total
      FROM months
      JOIN "Client" c ON TRUE
      ${where}
      AND (${windowCondition})
      GROUP BY months.month
      ORDER BY months.month ASC
    `)

    const counts: Record<string, number> = Object.fromEntries(
      Array.from({ length: 12 }).map((_, idx) => [padMonth(idx + 1), 0]),
    )
    for (const r of rows) {
      const key = padMonth(Number(r.month))
      counts[key] = Number(r.total) || 0
    }

    return NextResponse.json({ categoria, year, counts })
  } catch (error) {
    console.error("[clients][stats][by-month]", error)
    const message = error instanceof Error ? error.message : "Erro ao buscar contagens por mês."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

