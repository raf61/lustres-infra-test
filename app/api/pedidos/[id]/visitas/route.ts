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

    const visitas = await prisma.visitaTecnica.findMany({
      where: { pedidoId },
      select: {
        id: true,
        status: true,
        dataMarcada: true,
        dataRegistroInicio: true,
        dataRegistroFim: true,
        tecnico: {
          select: {
            fullname: true,
            name: true,
          },
        },
      },
      orderBy: { dataMarcada: "desc" },
    })
    const serialized = visitas.map((visita) => ({
      id: visita.id,
      status: visita.status,
      dataMarcada: visita.dataMarcada,
      dataRegistroInicio: visita.dataRegistroInicio,
      dataRegistroFim: visita.dataRegistroFim,
      tecnicoNome: visita.tecnico?.fullname ?? visita.tecnico?.name ?? null,
    }))

    return NextResponse.json({ data: serialized })
  } catch (error) {
    console.error("[pedido][visitas][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar visitas do pedido."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


