import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const vendedores = await prisma.user.findMany({
      where: { role: "VENDEDOR", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    })

    return NextResponse.json({ data: vendedores })
  } catch (error) {
    console.error("[VENDEDORES_GET]", error)
    return NextResponse.json({ error: "Erro ao buscar vendedores" }, { status: 500 })
  }
}


