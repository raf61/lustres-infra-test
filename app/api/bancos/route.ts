import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const bancos = await prisma.banco.findMany({
      orderBy: { nome: "asc" },
    })
    return NextResponse.json({ data: bancos })
  } catch (error) {
    console.error("[bancos][GET]", error)
    return NextResponse.json({ error: "Erro ao listar bancos." }, { status: 500 })
  }
}

