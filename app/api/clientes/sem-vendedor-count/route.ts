import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/clientes/sem-vendedor-count
 * Retorna a contagem de clientes ATIVOS que não possuem vendedor alocado
 */
export async function GET() {
  try {
    const count = await prisma.client.count({
      where: {
        categoria: "ATIVO",
        vendedorId: null,
      },
    })

    return NextResponse.json({ count })
  } catch (error) {
    console.error("[clientes][sem-vendedor-count][GET]", error)
    return NextResponse.json({ error: "Erro ao buscar contagem" }, { status: 500 })
  }
}

