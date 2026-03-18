import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { createEarlyApprovalRepository } from "@/domain/pedido/early-approval-repository"
import {
  getEarlyApprovalPreview,
  executeEarlyApproval,
} from "@/domain/pedido/early-approval-usecase"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

/**
 * GET /api/pedidos/[id]/aprovacao-precoce
 * 
 * Retorna o preview da aprovação precoce (o que vai acontecer)
 * Acesso controlado pelo middleware: MASTER, ADMINISTRADOR e FINANCEIRO
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const pedidoId = Number.parseInt(id, 10)

    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 })
    }

    const repository = createEarlyApprovalRepository(prisma)
    const preview = await getEarlyApprovalPreview(repository, { pedidoId })

    return NextResponse.json({ data: preview })
  } catch (error) {
    console.error("[pedidos][aprovacao-precoce][GET]", error)
    const message = error instanceof Error ? error.message : "Erro ao gerar preview."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/pedidos/[id]/aprovacao-precoce
 * 
 * Executa a aprovação precoce:
 * 1. Cancela visitas não finalizadas
 * 2. Altera status do pedido para AGUARDANDO_APROVACAO_FINAL
 * 
 * Acesso controlado pelo middleware: MASTER, ADMINISTRADOR e FINANCEIRO
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const pedidoId = Number.parseInt(id, 10)

    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 })
    }

    const repository = createEarlyApprovalRepository(prisma)
    const result = await executeEarlyApproval(repository, { pedidoId })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      data: {
        pedidoId: result.pedidoId,
        newStatus: result.newStatus,
        visitsCancelled: result.visitsCancelled,
      },
    })
  } catch (error) {
    console.error("[pedidos][aprovacao-precoce][POST]", error)
    const message = error instanceof Error ? error.message : "Erro ao executar aprovação precoce."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

