import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ id: string }>
}

const isPromise = (value: any): value is Promise<any> => typeof value?.then === "function"

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const rawParams = context.params
    const resolvedParams = isPromise(rawParams) ? await rawParams : rawParams
    const id = Number(resolvedParams.id)
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    if (!Object.prototype.hasOwnProperty.call(body, "custoBoleto")) {
      return NextResponse.json({ error: "Informe custoBoleto." }, { status: 400 })
    }

    const custoBoletoRaw = body.custoBoleto
    let custoBoleto: number | null = null
    if (custoBoletoRaw !== null && custoBoletoRaw !== undefined && `${custoBoletoRaw}`.trim() !== "") {
      const parsed = Number(custoBoletoRaw)
      if (Number.isNaN(parsed)) {
        return NextResponse.json({ error: "custoBoleto inválido." }, { status: 400 })
      }
      custoBoleto = parsed
    }

    const updated = await prisma.banco.update({
      where: { id },
      data: { custoBoleto },
      select: { id: true, nome: true, custoBoleto: true },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("[bancos][PATCH][custoBoleto]", error)
    return NextResponse.json({ error: "Erro ao atualizar custo do boleto." }, { status: 500 })
  }
}

