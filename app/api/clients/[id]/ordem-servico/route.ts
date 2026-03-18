import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getLoggedUserId } from "@/lib/vendor-dashboard"
import { createOsPedido } from "@/domain/pedido/os/create-os-pedido-usecase"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const clientId = Number.parseInt(id, 10)
    if (Number.isNaN(clientId)) {
      return NextResponse.json({ error: "Cliente inválido." }, { status: 400 })
    }

    let body: { empresaId?: number | string | null; observacoes?: string | null; detalhamento?: string | null; contratoId?: number | null } = {}
    try {
      body = (await request.json()) as typeof body
    } catch {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 })
    }

    const empresaId = Number.parseInt(String(body.empresaId ?? ""), 10)
    if (Number.isNaN(empresaId)) {
      return NextResponse.json({ error: "Empresa inválida." }, { status: 400 })
    }

    const creatorId = await getLoggedUserId()
    if (!creatorId) {
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 })
    }

    const result = await createOsPedido(prisma, {
      clienteId: clientId,
      creatorId,
      empresaId,
      observacoes: body.observacoes ?? null,
      detalhamento: body.detalhamento ?? null,
      contratoId: body.contratoId ?? null,
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a ordem de serviço."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

