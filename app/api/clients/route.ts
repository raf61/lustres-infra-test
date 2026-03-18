import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { extractDigits, formatCnpjDigits } from "@/lib/cnpj"
import { CLIENTS_MAX_LIMIT } from "@/lib/constants"
import {
  buildWhereConditions,
  buildCategoryConditions,
  buildBudgetConditions,
  buildHistoryConditions,
  buildContactConditions,
  buildScheduledDateConditions,
  buildOrderConditions,
  buildWhereClause,
  categoriaEnumList,
  categoriaEnumSqlMap,
  clienteExploradoCondition,
} from "@/app/api/clients/filters"
import { buildClientCreateData } from "@/domain/client/transform"

const PAGE_SIZE = 50

type CategoriaDbValue = "ATIVO" | "AGENDADO" | "EXPLORADO" | null

const mapCategoria = (
  categoria: CategoriaDbValue
): "ativo" | "agendado" | "explorado" => {
  switch (categoria) {
    case "ATIVO":
      return "ativo"
    case "AGENDADO":
      return "agendado"
    case "EXPLORADO":
      return "explorado"
    default:
      return "explorado"
  }
}

type RawDbClient = {
  id: number
  cnpj: string
  razaoSocial: string
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  dataContatoAgendado: Date | string | null
  ultimaManutencao: Date | string | null
  administradoraStringAntigo: string | null
  categoria: CategoriaDbValue
  administradora: {
    id: number | null
    nome: string | null
  } | null
  vendedor: {
    name: string | null
    role: string | null
  } | null
  nomeSindico: string | null
  vendedorAlocadoEm: Date | string | null
  fimContrato: Date | string | null
  isContratoVigente: boolean
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10)
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam
    const limitParam = Number.parseInt(searchParams.get("limit") ?? "", 10)
    const limit = Number.isNaN(limitParam) || limitParam < 1 ? null : Math.min(limitParam, CLIENTS_MAX_LIMIT)
    const baseConditions = buildWhereConditions(searchParams)
    const categoryConditions = buildCategoryConditions(searchParams)
    const budgetConditions = buildBudgetConditions(searchParams)
    const historyConditions = buildHistoryConditions(searchParams)
    const dataConditions: Prisma.Sql[] = [
      ...baseConditions,
      ...categoryConditions,
      ...budgetConditions,
      ...historyConditions,
      ...buildOrderConditions(searchParams),
      ...buildScheduledDateConditions(searchParams)
    ]

    const dataWhereClause = buildWhereClause(dataConditions)
    const withExtraCondition = (extra?: Prisma.Sql) =>
      buildWhereClause(extra ? [...dataConditions, extra] : [...dataConditions])

    const totalResult = await prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Client" c
      ${dataWhereClause}
    `)
    let total = totalResult[0]?.total ?? 0
    let totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    let currentPage = Math.min(page, totalPages)
    let skip = (currentPage - 1) * PAGE_SIZE
    const take = limit ?? PAGE_SIZE

    if (limit) {
      total = Math.min(total, limit)
      totalPages = 1
      currentPage = 1
      skip = 0
    }

    let orderByClause = Prisma.sql`ORDER BY c."createdAt" DESC`
    const categoriaParam = searchParams.get("categoria")
    if (categoriaParam === "explorado") {
      orderByClause = Prisma.sql`ORDER BY c."razaoSocial" ASC`
    } else if (categoriaParam === "ativo") {
      orderByClause = Prisma.sql`ORDER BY c."ultimaManutencao" ASC NULLS LAST, c."razaoSocial" ASC`
    } else if (categoriaParam === "agendado") {
      orderByClause = Prisma.sql`ORDER BY c."ultimaManutencao" ASC NULLS LAST, c."razaoSocial" ASC`
    }

    const [ativosResult, agendadosResult, exploradosResult, clients] = await Promise.all([
      prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM "Client" c
        ${withExtraCondition(Prisma.sql`c."categoria" = ${categoriaEnumSqlMap.ativo}`)}
      `),
      prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM "Client" c
        ${withExtraCondition(Prisma.sql`c."categoria" = ${categoriaEnumSqlMap.agendado}`)}
      `),
      prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM "Client" c
        ${withExtraCondition(clienteExploradoCondition)}
      `),
      prisma.$queryRaw<RawDbClient[]>(Prisma.sql`
        SELECT
          c.id,
          c.cnpj,
          c."razaoSocial",
          c.logradouro,
          c.numero,
          c.complemento,
          c.bairro,
          c.cidade,
          c.estado,
          c."dataContatoAgendado",
          c."ultimaManutencao",
          c."administradoraStringAntigo",
          c."nomeSindico",
          c."telefoneSindico",
          c.categoria,
          CASE
            WHEN c."administradoraId" IS NULL THEN NULL
            ELSE jsonb_build_object('id', a.id, 'nome', a.nome)
          END AS administradora,
          CASE
            WHEN c."vendedorId" IS NULL THEN NULL
            ELSE jsonb_build_object('name', v.name, 'role', v.role)
          END AS vendedor,
          c."vendedorAlocadoEm",
          EXISTS (
            SELECT 1 FROM "ContratoManutencao" cm
            WHERE cm."clienteId" = c.id
            AND cm.status = 'OK'
            AND cm."dataFim" >= CURRENT_DATE
          ) AS "isContratoVigente"
        FROM "Client" c
        LEFT JOIN "Administradora" a ON a.id = c."administradoraId"
        LEFT JOIN "User" v ON v.id = c."vendedorId"
        ${dataWhereClause}
        ${orderByClause}
        LIMIT ${take}
        OFFSET ${skip}
      `),
    ])

    const totalAtivos = ativosResult[0]?.total ?? 0
    const totalAgendados = agendadosResult[0]?.total ?? 0
    const totalExplorados = exploradosResult[0]?.total ?? 0
    return NextResponse.json({
      data: clients.map((client) => ({
        ...client,
        categoria: mapCategoria(client.categoria),
      })),
      pagination: {
        page: currentPage,
        pageSize: take,
        total,
        totalPages,
        hasNextPage: currentPage < totalPages && !limit,
      },
      summary: {
        ativo: totalAtivos,
        agendado: totalAgendados,
        explorado: totalExplorados,
      },
    })
  } catch (error) {
    console.error("Erro ao buscar clientes:", error)
    return NextResponse.json(
      { error: "Erro ao buscar clientes" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const buildResult = buildClientCreateData(body)
    if (!buildResult.ok) {
      return NextResponse.json({ error: buildResult.error.message }, { status: buildResult.error.status })
    }

    // Verify if CNPJ is in the blocked list (UnusedCnpjs)
    // The check uses queryRaw via verifyUnusedCnpj to match digits
    const { verifyUnusedCnpj } = await import("@/domain/client/verify-unused-cnpj")
    const isBlocked = await verifyUnusedCnpj(buildResult.data.cnpj)

    if (isBlocked) {
      return NextResponse.json({ error: "CNPJ Bloqueado: Este CNPJ consta na lista de clientes inválidos." }, { status: 400 })
    }

    const cliente = await prisma.client.create({
      data: buildResult.data,
    })

    return NextResponse.json(
      {
        id: cliente.id,
        cnpj: cliente.cnpj,
        razaoSocial: cliente.razaoSocial,
        categoria: mapCategoria(cliente.categoria),
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Já existe um cliente com esse CNPJ" }, { status: 409 })
    }
    console.error("Erro ao criar cliente:", error)
    return NextResponse.json({ error: "Erro ao criar cliente" }, { status: 500 })
  }
}

