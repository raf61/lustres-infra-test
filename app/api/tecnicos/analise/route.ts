import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { buildEndereco } from "@/lib/enderecos"

const PAGE_SIZE_DEFAULT = 30
const PAGE_SIZE_MAX = 30
const ADMIN_ROLES = ["MASTER", "ADMINISTRADOR"] as const

const parsePage = (value?: string | null) => {
  const page = Number(value || 1)
  if (!page || Number.isNaN(page) || page < 1) return 1
  return page
}

const parsePageSize = (value?: string | null) => {
  const size = Number(value || PAGE_SIZE_DEFAULT)
  if (!size || Number.isNaN(size) || size < 1) return PAGE_SIZE_DEFAULT
  return Math.min(size, PAGE_SIZE_MAX)
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    const role = (session?.user as { role?: string })?.role ?? null
    if (!role || !ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number])) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const tecnicoId = searchParams.get("tecnicoId")
    const pendentesOnly = searchParams.get("pendentes") === "1"
    const page = parsePage(searchParams.get("page"))
    const pageSize = parsePageSize(searchParams.get("pageSize"))

    const tecnicos = await prisma.user.findMany({
      where: { role: "TECNICO", active: true },
      select: { id: true, fullname: true, name: true },
      orderBy: { fullname: "asc" },
    })

    const tecnicoIds = tecnicos.map((t) => t.id)
    const counts = tecnicoIds.length
      ? await prisma.visitaTecnica.groupBy({
          by: ["tecnicoId"],
          _count: { _all: true },
          where: { tecnicoId: { in: tecnicoIds } },
        })
      : []
    const countMap = new Map(counts.map((row) => [row.tecnicoId, Number(row._count._all ?? 0)]))

    const tecnicosPayload = tecnicos.map((t) => ({
      id: t.id,
      nome: t.fullname ?? t.name ?? "Técnico",
      totalVisitas: countMap.get(t.id) ?? 0,
    }))

    if (!tecnicoId) {
      return NextResponse.json({
        tecnicos: tecnicosPayload,
        visitas: [],
        totalVisitas: 0,
        page: 1,
        totalPages: 1,
      })
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const baseWhere = {
      tecnicoId,
      ...(pendentesOnly
        ? { status: { in: ["AGUARDANDO", "EM_EXECUCAO"] }, dataMarcada: { lte: todayEnd } }
        : {}),
    }

    const totalVisitas = await prisma.visitaTecnica.count({
      where: baseWhere,
    })
    const totalPages = Math.max(1, Math.ceil(totalVisitas / pageSize))
    const safePage = Math.min(page, totalPages)

    const visitas = await prisma.visitaTecnica.findMany({
      where: baseWhere,
      orderBy: { dataMarcada: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        dataMarcada: true,
        pedidoId: true,
        cliente: {
          select: {
            id: true,
            razaoSocial: true,
            logradouro: true,
            numero: true,
            complemento: true,
            bairro: true,
            cidade: true,
            estado: true,
          },
        },
      },
    })

    return NextResponse.json({
      tecnicos: tecnicosPayload,
      visitas: visitas.map((visita) => ({
        id: visita.id,
        status: visita.status,
        dataMarcada: visita.dataMarcada.toISOString(),
        pedidoId: visita.pedidoId ?? null,
        clienteId: visita.cliente.id,
        clienteNome: visita.cliente.razaoSocial,
        endereco: buildEndereco(visita.cliente),
      })),
      totalVisitas,
      page: safePage,
      totalPages,
    })
  } catch (error) {
    console.error("[tecnicos][analise][GET]", error)
    return NextResponse.json({ error: "Erro ao carregar análise de técnicos." }, { status: 500 })
  }
}

