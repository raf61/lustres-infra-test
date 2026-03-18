import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const PAGE_SIZE = 30

type ExploradoClientRow = {
  id: number
  cnpj: string
  razaoSocial: string
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  categoria: string | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10)
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam
    const offset = (page - 1) * PAGE_SIZE

    const totalRows = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total
      FROM "Client" c
      WHERE c."categoria" IS NULL OR c."categoria" = 'EXPLORADO'
    `
    const total = totalRows.at(0)?.total ?? 0

    const leads = await prisma.$queryRaw<ExploradoClientRow[]>`
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
        c."categoria"
      FROM "Client" c
      WHERE c."categoria" IS NULL OR c."categoria" = 'EXPLORADO'
      ORDER BY c."razaoSocial" ASC
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
    console.error("Erro ao buscar leads explorados:", error)
    return NextResponse.json({ error: "Erro ao buscar leads explorados" }, { status: 500 })
  }
}
