import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  buildOrcamentoWhereConditions,
  buildOrcamentoBaseConditions,
  buildOrcamentoDateConditions,
  buildWhereClause,
} from "../filters"

const PAGE_SIZE = 50

type OrcamentoStatusDb = "EM_ABERTO" | "APROVADO" | "REPROVADO" | "CANCELADO" | null

type RawOrcamento = {
  id: number
  createdAt: Date
  status: OrcamentoStatusDb
  clienteId: number
  clienteRazaoSocial: string
  clienteNomeSindico: string | null
  clienteEstado: string | null
  clienteCidade: string | null
  clienteBairro: string | null
  vendedorId: string | null
  vendedorName: string | null
  empresaId: number | null
  empresaNome: string | null
  totalValor: number | null
}

type StatusCount = {
  status: OrcamentoStatusDb
  count: number
}

type EstadoCount = {
  estado: string | null
  count: number
  totalValor: number | null
}

type VendedorCount = {
  vendedorId: string | null
  vendedorName: string | null
  count: number
  totalValor: number | null
  countAprovado: number
  totalValorAprovado: number | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10)
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

    // Conditions WITH status filter (for listing and filtered totals)
    const fullConditions = buildOrcamentoWhereConditions(searchParams)
    const dateConditions = buildOrcamentoDateConditions(searchParams)
    const allConditions: Prisma.Sql[] = [...fullConditions, ...dateConditions]
    const whereClause = buildWhereClause(allConditions)

    // Conditions WITHOUT status filter (for status breakdown stats)
    const baseConditions = buildOrcamentoBaseConditions(searchParams)
    const baseWithDateConditions: Prisma.Sql[] = [...baseConditions, ...dateConditions]
    const baseWhereClause = buildWhereClause(baseWithDateConditions)

    // Count total
    const totalResult = await prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Orcamento" o
      JOIN "Client" c ON c.id = o."clienteId"
      ${whereClause}
    `)
    const total = totalResult[0]?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    const skip = (currentPage - 1) * PAGE_SIZE

    // Fetch orçamentos with related data
    const orcamentos = await prisma.$queryRaw<RawOrcamento[]>(Prisma.sql`
      SELECT
        o.id,
        o."createdAt",
        o.status,
        o."clienteId",
        c."razaoSocial" AS "clienteRazaoSocial",
        c."nomeSindico" AS "clienteNomeSindico",
        c.estado AS "clienteEstado",
        c.cidade AS "clienteCidade",
        c.bairro AS "clienteBairro",
        o."vendedorId",
        v.name AS "vendedorName",
        o."empresaId",
        e.nome AS "empresaNome",
        (
          SELECT COALESCE(SUM(oi.quantidade * oi.valor), 0)
          FROM "OrcamentoItem" oi
          WHERE oi."orcamentoId" = o.id
        )::float AS "totalValor"
      FROM "Orcamento" o
      JOIN "Client" c ON c.id = o."clienteId"
      LEFT JOIN "User" v ON v.id = o."vendedorId"
      LEFT JOIN "Empresa" e ON e.id = o."empresaId"
      ${whereClause}
      ORDER BY o."createdAt" DESC
      LIMIT ${PAGE_SIZE}
      OFFSET ${skip}
    `)

    // Get total value for current filter
    const totalValueResult = await prisma.$queryRaw<{ total: number; totalAprovado: number }[]>(Prisma.sql`
      SELECT 
        COALESCE(SUM(item_totals.subtotal), 0)::float AS total,
        COALESCE(SUM(item_totals.subtotal) FILTER (WHERE o.status = 'APROVADO'::"OrcamentoStatus"), 0)::float AS "totalAprovado"
      FROM "Orcamento" o
      JOIN "Client" c ON c.id = o."clienteId"
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(oi.quantidade * oi.valor), 0) AS subtotal
        FROM "OrcamentoItem" oi
        WHERE oi."orcamentoId" = o.id
      ) item_totals ON true
      ${whereClause}
    `)
    const totalValue = totalValueResult[0]?.total ?? 0
    const totalValueAprovado = totalValueResult[0]?.totalAprovado ?? 0

    // Count by status (uses baseWhereClause - excludes status filter so we always see full breakdown)
    const statusCounts = await prisma.$queryRaw<StatusCount[]>(Prisma.sql`
      SELECT o.status, COUNT(*)::int AS count
      FROM "Orcamento" o
      JOIN "Client" c ON c.id = o."clienteId"
      ${baseWhereClause}
      GROUP BY o.status
    `)

    // Also get counts for each status using full filter (for consistent metrics when status is filtered)
    const filteredStatusCounts = await prisma.$queryRaw<StatusCount[]>(Prisma.sql`
      SELECT o.status, COUNT(*)::int AS count
      FROM "Orcamento" o
      JOIN "Client" c ON c.id = o."clienteId"
      ${whereClause}
      GROUP BY o.status
    `)

    // Distribution by estado
    const estadoCounts = await prisma.$queryRaw<EstadoCount[]>(Prisma.sql`
      SELECT 
        c.estado,
        COUNT(*)::int AS count,
        COALESCE(SUM(item_totals.subtotal), 0)::float AS "totalValor"
      FROM "Orcamento" o
      JOIN "Client" c ON c.id = o."clienteId"
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(oi.quantidade * oi.valor), 0) AS subtotal
        FROM "OrcamentoItem" oi
        WHERE oi."orcamentoId" = o.id
      ) item_totals ON true
      ${whereClause}
      GROUP BY c.estado
      ORDER BY count DESC
    `)

    // Distribution by vendedor (with approved breakdown)
    const vendedorCounts = await prisma.$queryRaw<VendedorCount[]>(Prisma.sql`
      SELECT 
        o."vendedorId",
        v.name AS "vendedorName",
        COUNT(*)::int AS count,
        COALESCE(SUM(item_totals.subtotal), 0)::float AS "totalValor",
        COUNT(*) FILTER (WHERE o.status = 'APROVADO'::"OrcamentoStatus")::int AS "countAprovado",
        COALESCE(SUM(item_totals.subtotal) FILTER (WHERE o.status = 'APROVADO'::"OrcamentoStatus"), 0)::float AS "totalValorAprovado"
      FROM "Orcamento" o
      JOIN "Client" c ON c.id = o."clienteId"
      LEFT JOIN "User" v ON v.id = o."vendedorId"
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(oi.quantidade * oi.valor), 0) AS subtotal
        FROM "OrcamentoItem" oi
        WHERE oi."orcamentoId" = o.id
      ) item_totals ON true
      ${whereClause}
      GROUP BY o."vendedorId", v.name
      ORDER BY count DESC
    `)

    return NextResponse.json({
      data: orcamentos.map((orc) => ({
        id: orc.id,
        createdAt: orc.createdAt,
        status: orc.status,
        cliente: {
          id: orc.clienteId,
          razaoSocial: orc.clienteRazaoSocial,
          nomeSindico: orc.clienteNomeSindico,
          estado: orc.clienteEstado,
          cidade: orc.clienteCidade,
          bairro: orc.clienteBairro,
        },
        vendedor: orc.vendedorId
          ? { id: orc.vendedorId, name: orc.vendedorName }
          : null,
        empresa: orc.empresaId
          ? { id: orc.empresaId, nome: orc.empresaNome }
          : null,
        totalValor: orc.totalValor ?? 0,
      })),
      pagination: {
        page: currentPage,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
        hasNextPage: currentPage < totalPages,
      },
      summary: {
        totalValue,
        totalValueAprovado,
        // byStatus uses baseWhereClause (for breakdown without status filter - useful for charts)
        byStatus: statusCounts.reduce(
          (acc, item) => {
            acc[item.status ?? "null"] = item.count
            return acc
          },
          {} as Record<string, number>,
        ),
        // byStatusFiltered uses full whereClause (consistent with current filter)
        byStatusFiltered: filteredStatusCounts.reduce(
          (acc, item) => {
            acc[item.status ?? "null"] = item.count
            return acc
          },
          {} as Record<string, number>,
        ),
        byEstado: estadoCounts.map((item) => ({
          estado: item.estado ?? "Não informado",
          count: item.count,
          totalValor: item.totalValor ?? 0,
        })),
        byVendedor: vendedorCounts.map((item) => ({
          vendedorId: item.vendedorId,
          vendedorName: item.vendedorName ?? "Sem vendedor",
          count: item.count,
          totalValor: item.totalValor ?? 0,
          countAprovado: item.countAprovado,
          totalValorAprovado: item.totalValorAprovado ?? 0,
        })),
      },
    })
  } catch (error) {
    console.error("[orcamentos/list][GET]", error)
    return NextResponse.json(
      { error: "Erro ao buscar orçamentos" },
      { status: 500 },
    )
  }
}

