import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const DEFAULT_LIMIT = 8
const MAX_LIMIT = 25

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("query") ?? searchParams.get("search") ?? ""
    const normalized = query.trim()
    const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10)
    const limit = Number.isNaN(limitParam)
      ? DEFAULT_LIMIT
      : Math.max(1, Math.min(limitParam, MAX_LIMIT))

    const whereClause =
      normalized.length >= 2
        ? {
            nome: {
              contains: normalized,
              mode: "insensitive",
            },
          }
        : undefined

    const items = await prisma.item.findMany({
      where: whereClause,
      orderBy: { nome: "asc" },
      //take: limit,
      select: {
        id: true,
        nome: true,
        valor: true,
        categoria: true,
      },
    })

    const payload = items.map((item) => ({
      id: item.id.toString(),
      nome: item.nome,
      valor: item.valor,
      categoria: item.categoria ?? null,
    }))

    return NextResponse.json({ data: payload })
  } catch (error) {
    console.error("[items][GET]", error)
    return NextResponse.json({ error: "Não foi possível carregar os produtos/serviços." }, { status: 500 })
  }
}

