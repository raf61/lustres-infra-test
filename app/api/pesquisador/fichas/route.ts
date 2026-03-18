import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildWhereClause, buildWhereConditions } from "@/app/api/fichas/route"
import { getLoggedUserId } from "@/lib/vendor-dashboard"

const PAGE_SIZE = 50

type RawFicha = {
  id: number
  cnpj: string
  razaoSocial: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  nomeSindico: string | null
  fichaStatus: string
  updatedAt: Date
  pesquisadorName: string | null
}

export async function GET(request: Request) {
  try {
    // Obtém o ID do usuário logado
    const currentUserId = await getLoggedUserId()
    
    if (!currentUserId) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const params = new URLSearchParams(searchParams)

    // Filtra pelo pesquisador logado
    params.set("pesquisadorId", currentUserId)

    const pageParam = Number.parseInt(params.get("page") ?? "1", 10)
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

    const whereConditions = buildWhereConditions(params)
    const whereClause = buildWhereClause(whereConditions)

    const [totalResult, fichas] = await Promise.all([
      prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM "Ficha" f
        ${whereClause}
      `),
      prisma.$queryRaw<RawFicha[]>(Prisma.sql`
        SELECT
          f.id,
          f.cnpj,
          f."razaoSocial",
          f.logradouro,
          f.numero,
          f.bairro,
          f.cidade,
          f.estado,
          f."nomeSindico",
          f."fichaStatus",
          f."updatedAt",
          u.name as "pesquisadorName"
        FROM "Ficha" f
        LEFT JOIN "User" u ON u.id = f."pesquisadorId"
        ${whereClause}
        ORDER BY f."updatedAt" DESC, f.id DESC
        LIMIT ${PAGE_SIZE}
        OFFSET ${(page - 1) * PAGE_SIZE}
      `),
    ])

    const total = totalResult[0]?.total ?? 0

    return NextResponse.json({
      fichas: fichas.map((ficha) => ({
        id: ficha.id,
        cnpj: ficha.cnpj,
        razaoSocial: ficha.razaoSocial,
        logradouro: ficha.logradouro,
        numero: ficha.numero,
        bairro: ficha.bairro,
        cidade: ficha.cidade,
        estado: ficha.estado,
        nomeSindico: ficha.nomeSindico,
        fichaStatus: ficha.fichaStatus,
        updatedAt: ficha.updatedAt.toISOString(),
        pesquisadorName: ficha.pesquisadorName,
      })),
      total,
    })
  } catch (error) {
    console.error("[pesquisador][fichas][GET]", error)
    return NextResponse.json({ error: "Erro ao listar fichas do pesquisador" }, { status: 500 })
  }
}

