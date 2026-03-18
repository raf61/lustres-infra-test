import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildWhereConditions, buildCategoryConditions, buildWhereClause } from "@/app/api/clients/filters"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    const baseConditions = buildWhereConditions(searchParams)
    const categoryConditions = buildCategoryConditions(searchParams)
    const allConditions = [...baseConditions, ...categoryConditions]
    const whereClause = buildWhereClause(allConditions)

    const result = await prisma.$queryRaw<{ vendedorId: string | null; vendedor: string | null; total: number }[]>(Prisma.sql`
      SELECT
        v.id AS "vendedorId",
        COALESCE(v.name, 'Sem Vendedor') AS vendedor,
        COUNT(*)::int AS total
      FROM "Client" c
      LEFT JOIN "User" v ON v.id = c."vendedorId"
      ${whereClause}
      GROUP BY v.id, COALESCE(v.name, 'Sem Vendedor')
      ORDER BY total DESC
    `)

    const totalOverall = result.reduce((sum, item) => sum + item.total, 0)

    return NextResponse.json({
      distribution: result.map(item => ({
        vendedorId: item.vendedorId,
        vendedor: item.vendedor === null ? "Sem Vendedor" : item.vendedor,
        total: item.total,
      })),
      total: totalOverall,
    })
  } catch (error) {
    console.error("Erro ao buscar distribuição por vendedor:", error)
    return NextResponse.json({ error: "Erro ao buscar distribuição por vendedor" }, { status: 500 })
  }
}

