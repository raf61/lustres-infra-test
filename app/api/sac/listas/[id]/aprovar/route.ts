import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { aprovarListaExtraNormal } from "@/domain/pedido/lista-extra/aprovar-lista-extra-usecase"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const listaId = Number.parseInt(id, 10)
    if (Number.isNaN(listaId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    }

    await aprovarListaExtraNormal(prisma, { listaId })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[sac][lista-aprovar][POST]", error)
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível aprovar a lista extra."
    const status =
      message === "Lista extra não encontrada."
      || message === "Lista extra não está vinculada a um pedido."
        ? 404
        : 400
    return NextResponse.json({ error: message }, { status })
  }
}
