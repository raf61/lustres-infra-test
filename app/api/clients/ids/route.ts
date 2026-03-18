import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { CLIENTS_MAX_LIMIT } from "@/lib/constants"
import {
  buildWhereConditions,
  buildCategoryConditions,
  buildBudgetConditions,
  buildHistoryConditions,
  buildContactConditions,
  buildWhereClause,
} from "@/app/api/clients/filters"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10)
    const limit = Number.isNaN(limitParam) || limitParam < 1 ? null : Math.min(limitParam, CLIENTS_MAX_LIMIT)

    const baseConditions = buildWhereConditions(searchParams)
    const categoryConditions = buildCategoryConditions(searchParams)
    const budgetConditions = buildBudgetConditions(searchParams)
    const historyConditions = buildHistoryConditions(searchParams)
    const conditions: Prisma.Sql[] = [
      ...baseConditions,
      ...categoryConditions,
      ...budgetConditions,
      ...historyConditions,
    ]
    const whereClause = buildWhereClause(conditions)

    let orderByClause = Prisma.sql`ORDER BY c."createdAt" DESC`
    const categoriaParam = searchParams.get("categoria")
    if (categoriaParam === "explorado") {
      orderByClause = Prisma.sql`ORDER BY c."razaoSocial" ASC`
    } else if (categoriaParam === "ativo") {
      orderByClause = Prisma.sql`ORDER BY c."ultimaManutencao" ASC NULLS LAST, c."razaoSocial" ASC`
    } else if (categoriaParam === "agendado") {
      orderByClause = Prisma.sql`ORDER BY c."dataContatoAgendado" ASC NULLS LAST, c."razaoSocial" ASC`
    }

    const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      SELECT c.id
      FROM "Client" c
      ${whereClause}
      ${orderByClause}
      ${limit ? Prisma.sql`LIMIT ${limit}` : Prisma.sql``}
    `)

    return NextResponse.json(rows.map((r) => r.id))
  } catch (error) {
    console.error("[clients][ids][GET]", error)
    return NextResponse.json({ error: "Erro ao buscar IDs de clientes" }, { status: 500 })
  }
}

