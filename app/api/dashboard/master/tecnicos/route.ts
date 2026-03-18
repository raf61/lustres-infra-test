import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildEndereco } from "@/lib/enderecos"

type TecnicoResumo = {
  id: string
  nome: string
  pendentes: number
  emExecucao: null | {
    visitaId: number
    pedidoId: number | null
    endereco: string
  }
}

export async function GET() {
  try {
    const tecnicos = await prisma.user.findMany({
      where: { role: "TECNICO", active: true },
      select: { id: true, fullname: true, name: true },
      orderBy: { fullname: "asc" },
    })

    if (!tecnicos.length) {
      return NextResponse.json({ data: [] })
    }

    const tecnicoIds = tecnicos.map((t) => t.id)

    const pendentes = await prisma.visitaTecnica.groupBy({
      by: ["tecnicoId"],
      _count: { _all: true },
      where: {
        tecnicoId: { in: tecnicoIds },
        status: { in: ["AGUARDANDO", "EM_EXECUCAO"] },
      },
    })

    const pendentesMap = new Map(
      pendentes.map((item) => [item.tecnicoId, Number(item._count._all ?? 0)]),
    )

    const emExecucao = await prisma.visitaTecnica.findMany({
      where: {
        tecnicoId: { in: tecnicoIds },
        status: "EM_EXECUCAO",
      },
      select: {
        id: true,
        tecnicoId: true,
        pedidoId: true,
        dataRegistroInicio: true,
        dataMarcada: true,
        cliente: {
          select: {
            logradouro: true,
            numero: true,
            complemento: true,
            bairro: true,
            cidade: true,
            estado: true,
          },
        },
      },
      orderBy: [{ dataRegistroInicio: "desc" }, { dataMarcada: "desc" }],
    })

    const emExecucaoMap = new Map<string, TecnicoResumo["emExecucao"]>()
    for (const visita of emExecucao) {
      if (emExecucaoMap.has(visita.tecnicoId)) continue
      emExecucaoMap.set(visita.tecnicoId, {
        visitaId: visita.id,
        pedidoId: visita.pedidoId ?? null,
        endereco: buildEndereco(visita.cliente),
      })
    }

    const data: TecnicoResumo[] = tecnicos.map((tecnico) => ({
      id: tecnico.id,
      nome: tecnico.fullname ?? tecnico.name ?? "Técnico",
      pendentes: pendentesMap.get(tecnico.id) ?? 0,
      emExecucao: emExecucaoMap.get(tecnico.id) ?? null,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error("[dashboard][master][tecnicos][GET]", error)
    return NextResponse.json({ error: "Erro ao carregar técnicos" }, { status: 500 })
  }
}

