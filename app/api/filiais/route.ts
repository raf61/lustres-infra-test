import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const empresaIdParam = req.nextUrl.searchParams.get("empresaId")
  const where =
    empresaIdParam && !Number.isNaN(Number(empresaIdParam)) ? { empresaId: Number(empresaIdParam) } : undefined

  try {
    const filiais = await prisma.filial.findMany({
      where,
      orderBy: { cnpj: "asc" },
      select: {
        id: true,
        empresaId: true,
        cnpj: true,
        uf: true,
        dadosCadastrais: true,
        inscricao_municipal: true,
        cod_atividade: true,
        empresa: { select: { id: true, nome: true } },
      },
    })

    return NextResponse.json({ data: filiais })
  } catch (error) {
    console.error("[filiais][GET]", error)
    return NextResponse.json({ error: "Não foi possível listar filiais." }, { status: 500 })
  }
}

