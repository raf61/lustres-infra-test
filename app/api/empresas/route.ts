import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const empresas = await prisma.empresa.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    })
    return NextResponse.json({ data: empresas })
  } catch (error) {
    console.error("[empresas][GET]", error)
    return NextResponse.json({ error: "Não foi possível listar empresas." }, { status: 500 })
  }
}

