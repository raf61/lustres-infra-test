import { NextResponse } from "next/server"
import { ListaExtraStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type ItemInput = {
  itemId: number
  quantidade: number
  valorPraticado: number
}

type EditarListaBody = {
  itens: ItemInput[]
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const listaId = Number.parseInt(id, 10)
    if (Number.isNaN(listaId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 })
    }

    const body: EditarListaBody = await request.json()
    const { itens } = body

    if (!Array.isArray(itens)) {
      return NextResponse.json({ error: "Lista de itens inválida." }, { status: 400 })
    }

    const lista = await prisma.listaExtra.findUnique({
      where: { id: listaId },
      include: {
        visita: { select: { id: true, pedidoId: true } },
      },
    })

    if (!lista) {
      return NextResponse.json({ error: "Lista extra não encontrada." }, { status: 404 })
    }

    if (lista.status !== ListaExtraStatus.PENDENTE) {
      return NextResponse.json({ error: "Apenas listas pendentes podem ser editadas." }, { status: 400 })
    }

    // Filtra itens com quantidade > 0
    const itensValidos = itens.filter((item) => item.quantidade > 0)

    await prisma.$transaction(async (tx) => {
      // Remove todos os itens existentes da lista
      await tx.listaExtraItem.deleteMany({
        where: { listaExtraId: listaId },
      })

      // Cria os novos itens com valor praticado
      if (itensValidos.length > 0) {
        await tx.listaExtraItem.createMany({
          data: itensValidos.map((item) => ({
            listaExtraId: listaId,
            itemId: BigInt(item.itemId),
            quantidade: item.quantidade,
            valorPraticado: item.valorPraticado,
          })),
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[sac][lista-editar][PUT]", error)
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível editar a lista extra."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

