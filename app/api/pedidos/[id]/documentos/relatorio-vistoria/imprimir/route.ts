import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { renderRelatorioVistoriaBlankPdfBuffer } from "@/lib/documents/relatorio-vistoria"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = (session.user as any).role
    const allowedRoles = ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "FINANCEIRO"]
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await context.params
    const pedidoId = Number.parseInt(id, 10)
    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 })
    }

    const buffer = await renderRelatorioVistoriaBlankPdfBuffer({ pedidoId })
    if (!buffer) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
    }

    const headers = new Headers()
    headers.set("Content-Type", "application/pdf")
    headers.set("Cache-Control", "no-store")
    headers.set("Content-Disposition", `inline; filename="relatorio-vistoria-${pedidoId}-blank.pdf"`)

    return new NextResponse(buffer as any, { status: 200, headers })
  } catch (error) {
    console.error("[pedido][relatorio-vistoria][imprimir]", error)
    return NextResponse.json({ error: "Erro ao gerar relatório de vistoria." }, { status: 500 })
  }
}

