import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const id = Number(resolvedParams.id)
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 })
  }

  const body = await req.json()
  if (body?.cnpj || body?.uf) {
    return NextResponse.json({ error: "CNPJ e UF não podem ser editados." }, { status: 400 })
  }

  const { dadosCadastrais, inscricao_municipal, cod_atividade } = body ?? {}

  const updateData: any = {
    ...(dadosCadastrais ? { dadosCadastrais } : {}),
    inscricao_municipal: inscricao_municipal ?? null,
    cod_atividade: cod_atividade ?? null,
  }

  try {
    const filial = await prisma.filial.update({
      where: { id },
      data: updateData as any,
      select: {
        id: true,
        empresaId: true,
        cnpj: true,
        uf: true,
        dadosCadastrais: true,
        inscricao_municipal: true,
        cod_atividade: true,
        empresa: { select: { id: true, nome: true } },
      } as any,
    })

    return NextResponse.json({ data: filial })
  } catch (error) {
    console.error(`[filiais][PATCH][${id}]`, error)
    return NextResponse.json({ error: "Não foi possível atualizar a filial." }, { status: 500 })
  }
}

