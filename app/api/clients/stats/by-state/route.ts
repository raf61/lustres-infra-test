import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  buildWhereConditions,
  buildCategoryConditions,
  buildWhereClause,
} from "@/app/api/clients/filters"

type StateCount = {
  estado: string | null
  total: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const baseConditions = buildWhereConditions(searchParams)
    const categoryConditions = buildCategoryConditions(searchParams)
    const dataConditions: Prisma.Sql[] = [...baseConditions, ...categoryConditions]
    const dataWhereClause = buildWhereClause(dataConditions)

    const results = await prisma.$queryRaw<StateCount[]>(Prisma.sql`
      SELECT 
        c.estado,
        COUNT(*)::int AS total
      FROM "Client" c
      ${dataWhereClause}
      GROUP BY c.estado
      ORDER BY total DESC
    `)

    // Normalize null states to "Não informado"
    const distribution = results.map((row) => ({
      estado: row.estado || "N/I",
      total: row.total,
    }))

    const grandTotal = distribution.reduce((sum, row) => sum + row.total, 0)

    return NextResponse.json({
      distribution,
      total: grandTotal,
    })
  } catch (error) {
    console.error("Erro ao buscar distribuição por estado:", error)
    return NextResponse.json(
      { error: "Erro ao buscar distribuição por estado" },
      { status: 500 }
    )
  }
}

