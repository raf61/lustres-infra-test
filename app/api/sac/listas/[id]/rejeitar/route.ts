import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rejeitarListaExtraNormal } from "@/domain/pedido/lista-extra/rejeitar-lista-extra-usecase"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

// Rejeita a lista extra e avança o fluxo do pedido sem adicionar itens.
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const listaId = Number.parseInt(id, 10)
    if (Number.isNaN(listaId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    }

    await rejeitarListaExtraNormal(prisma, { listaId })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[sac][lista-rejeitar][POST]", error)
    const message =
      error instanceof Error ? error.message : "Não foi possível rejeitar a lista extra."
    const status =
      message === "Lista extra não encontrada."
      || message === "Lista extra não está vinculada a um pedido."
        ? 404
        : 400
    return NextResponse.json({ error: message }, { status })
  }
}

