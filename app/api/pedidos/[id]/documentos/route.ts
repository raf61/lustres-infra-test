import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const pedidoId = Number.parseInt(id, 10)
    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 })
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        documentosOperacionais: {
          include: { assinaturas: true },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!pedido) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
    }

    const data = (pedido.documentosOperacionais ?? []).map((doc) => ({
      id: doc.id,
      tipo: doc.tipo,
      status: doc.status,
      url: doc.url,
      assinaturas: doc.assinaturas.map((ass) => ({
        id: ass.id,
        nomeCompletoAssinante: ass.nomeCompletoAssinante,
        cpfAssinante: ass.cpfAssinante,
        localizacao: ass.localizacao,
        url: ass.url,
        dadosExtras: ass.dadosExtras,
      })),
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error("[pedido][documentos][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar documentos do pedido."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


