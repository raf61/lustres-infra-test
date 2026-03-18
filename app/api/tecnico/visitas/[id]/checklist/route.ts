import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolvePedidoTipoEspecialByVisita } from "@/domain/pedido/visitas/resolve-tipo-por-visita-usecase"
import { salvarChecklistNormal, salvarChecklistOs } from "@/domain/pedido/visitas/salvar-checklist-usecase"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const visitaId = Number.parseInt(id, 10)
    if (Number.isNaN(visitaId)) {
      return NextResponse.json({ error: "ID da visita inválido." }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as { checklist?: unknown }
    if (!Array.isArray(body.checklist)) {
      return NextResponse.json({ error: "Checklist inválido." }, { status: 400 })
    }

    const sanitize = body.checklist
      .map((item) => {
        if (!item || typeof item !== "object") return null
        const { itemId, nome, quantidade, condicoes } = item as Record<string, unknown>
        const idNum = Number(itemId)
        const qtdNum = Number(quantidade)
        const nomeStr = typeof nome === "string" ? nome : ""
        const condicoesStr = typeof condicoes === "string" ? condicoes.trim() : ""
        if (!Number.isFinite(idNum) || idNum <= 0) return null
        if (!Number.isFinite(qtdNum) || qtdNum <= 0) return null
        if (!condicoesStr) return null
        return { itemId: idNum, nome: nomeStr, quantidade: qtdNum, condicoes: condicoesStr }
      })
      .filter(Boolean) as Array<{ itemId: number; nome: string; quantidade: number; condicoes: string }>

    const tipoEspecial = await resolvePedidoTipoEspecialByVisita(prisma, visitaId)
    const updated =
      tipoEspecial === "OS"
        ? await salvarChecklistOs(prisma, { visitaId, checklist: sanitize })
        : await salvarChecklistNormal(prisma, { visitaId, checklist: sanitize })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("[tecnico][visitas][checklist][POST]", error)
    const message = error instanceof Error ? error.message : "Não foi possível salvar o checklist."
    const status =
      message === "Visita técnica não encontrada."
        ? 404
        : 400
    return NextResponse.json({ error: message }, { status })
  }
}

