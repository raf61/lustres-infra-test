import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { resolvePedidoTipoEspecial } from "@/domain/pedido/resolve-tipo-especial-usecase"
import { aprovarFinalNormal } from "@/domain/pedido/aprovacoes/aprovar-final-normal-usecase"
import { aprovarFinalOs } from "@/domain/pedido/aprovacoes/aprovar-final-os-usecase"
import { auth } from "@/auth"

const ALLOWED_ROLES = new Set(["MASTER", "ADMINISTRADOR", "FINANCEIRO"])

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type AprovarPayload = {
  emitirDebitos?: boolean
  emitirLaudoTecnico?: boolean
  emitirCartaEndosso?: boolean // apenas para empresaId=1 (EBR)
  bancoEmissorId?: number
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const role = (session.user as { role?: string | null })?.role ?? null
    if (!role || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await context.params
    const pedidoId = Number.parseInt(id, 10)
    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as AprovarPayload

    const tipoEspecial = await resolvePedidoTipoEspecial(prisma, pedidoId)

    if (tipoEspecial !== "OS") {
      const bancoEmissorId = body.bancoEmissorId

      if (!bancoEmissorId) {
        throw new Error("Selecione o banco emissor.")
      }

      const bancoExiste = await prisma.banco.findUnique({ where: { id: bancoEmissorId } })
      if (!bancoExiste) {
        throw new Error("Banco emissor não encontrado.")
      }

      await prisma.pedido.update({
        where: { id: pedidoId },
        data: { bancoEmissorId },
      })
    }

    if (tipoEspecial === "OS") {
      await aprovarFinalOs(prisma, { pedidoId })
    } else {
      await aprovarFinalNormal(prisma, {
        pedidoId,
        emitirLaudoTecnico: body.emitirLaudoTecnico,
        emitirCartaEndosso: body.emitirCartaEndosso,
        bancoEmissorId: body.bancoEmissorId,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[admin][aprovacoes][aprovar][POST]", error)
    const message =
      error instanceof Error ? error.message : "Não foi possível aprovar este pedido."
    const status = message === "Pedido não encontrado." || message === "Banco emissor não encontrado." ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

