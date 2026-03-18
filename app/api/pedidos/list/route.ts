import { NextResponse } from "next/server"
import { Prisma, PedidoStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { toDateInputValue } from "@/lib/date-utils"
import {
  buildPedidoWhereConditions,
  buildPedidoBaseConditions,
  buildPedidoDateConditions,
  buildWhereClause,
} from "../filters"

const PAGE_SIZE = 50

type RawPedido = {
  id: number
  createdAt: Date
  status: PedidoStatus
  tipoEspecial: string | null
  geradoART: boolean | null
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
  contratoId: number | null
  contratoStatus: string | null
  contratoDataFim: Date | null
}

type StatusCount = {
  status: PedidoStatus
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
  countConcluido: number
  totalValorConcluido: number | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10)
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

    // Conditions WITH status filter (for listing and filtered totals)
    const fullConditions = buildPedidoWhereConditions(searchParams)
    const dateConditions = buildPedidoDateConditions(searchParams)
    const allConditions: Prisma.Sql[] = [...fullConditions, ...dateConditions]
    const whereClause = buildWhereClause(allConditions)

    // Conditions WITHOUT status filter (for status breakdown stats)
    const baseConditions = buildPedidoBaseConditions(searchParams)
    const baseWithDateConditions: Prisma.Sql[] = [...baseConditions, ...dateConditions]
    const baseWhereClause = buildWhereClause(baseWithDateConditions)

    // Count total
    const totalResult = await prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM "Pedido" p
      JOIN "Client" c ON c.id = p."clienteId"
      JOIN "Orcamento" o ON o.id = p."orcamentoId"
      ${whereClause}
    `)
    const total = totalResult[0]?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    const skip = (currentPage - 1) * PAGE_SIZE

    // Fetch pedidos with related data (empresa is on Orcamento, not Pedido)
    const pedidos = await prisma.$queryRaw<RawPedido[]>(Prisma.sql`
      SELECT
        p.id,
        p."createdAt",
        p.status,
        p."tipoEspecial",
        p."geradoART",
        p."clienteId",
        c."razaoSocial" AS "clienteRazaoSocial",
        c."nomeSindico" AS "clienteNomeSindico",
        c.estado AS "clienteEstado",
        c.cidade AS "clienteCidade",
        c.bairro AS "clienteBairro",
        p."vendedorId",
        v.name AS "vendedorName",
        o."empresaId",
        e.nome AS "empresaNome",
        p."contratoId",
        (
          SELECT COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0)
          FROM "PedidoItem" pi
          WHERE pi."pedidoId" = p.id
        )::float AS "totalValor",
        cm.status AS "contratoStatus",
        cm."dataFim" AS "contratoDataFim"
      FROM "Pedido" p
      JOIN "Client" c ON c.id = p."clienteId"
      JOIN "Orcamento" o ON o.id = p."orcamentoId"
      LEFT JOIN "User" v ON v.id = p."vendedorId"
      LEFT JOIN "Empresa" e ON e.id = o."empresaId"
      LEFT JOIN "ContratoManutencao" cm ON cm.id = p."contratoId"
      ${whereClause}
      ORDER BY p."createdAt" DESC
      LIMIT ${PAGE_SIZE}
      OFFSET ${skip}
    `)

    // Get total value for current filter (excluding cancelled)
    const totalValueResult = await prisma.$queryRaw<{ total: number; totalConcluido: number }[]>(Prisma.sql`
      SELECT 
        COALESCE(SUM(item_totals.subtotal) FILTER (WHERE p.status != 'CANCELADO'::"PedidoStatus"), 0)::float AS total,
        COALESCE(SUM(item_totals.subtotal) FILTER (WHERE p.status = 'CONCLUIDO'::"PedidoStatus"), 0)::float AS "totalConcluido"
      FROM "Pedido" p
      JOIN "Client" c ON c.id = p."clienteId"
      JOIN "Orcamento" o ON o.id = p."orcamentoId"
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0) AS subtotal
        FROM "PedidoItem" pi
        WHERE pi."pedidoId" = p.id
      ) item_totals ON true
      ${whereClause}
    `)
    const totalValue = totalValueResult[0]?.total ?? 0
    const totalValueConcluido = totalValueResult[0]?.totalConcluido ?? 0

    // Count by status (uses baseWhereClause - excludes status filter so we always see full breakdown)
    const statusCounts = await prisma.$queryRaw<StatusCount[]>(Prisma.sql`
      SELECT p.status, COUNT(*)::int AS count
      FROM "Pedido" p
      JOIN "Client" c ON c.id = p."clienteId"
      JOIN "Orcamento" o ON o.id = p."orcamentoId"
      ${baseWhereClause}
      GROUP BY p.status
    `)

    // Also get counts for each status using full filter (for consistent metrics when status is filtered)
    const filteredStatusCounts = await prisma.$queryRaw<StatusCount[]>(Prisma.sql`
      SELECT p.status, COUNT(*)::int AS count
      FROM "Pedido" p
      JOIN "Client" c ON c.id = p."clienteId"
      JOIN "Orcamento" o ON o.id = p."orcamentoId"
      ${whereClause}
      GROUP BY p.status
    `)

    // Distribution by estado
    const estadoCounts = await prisma.$queryRaw<EstadoCount[]>(Prisma.sql`
      SELECT 
        c.estado,
        COUNT(*)::int AS count,
        COALESCE(SUM(item_totals.subtotal), 0)::float AS "totalValor"
      FROM "Pedido" p
      JOIN "Client" c ON c.id = p."clienteId"
      JOIN "Orcamento" o ON o.id = p."orcamentoId"
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0) AS subtotal
        FROM "PedidoItem" pi
        WHERE pi."pedidoId" = p.id
      ) item_totals ON true
      ${whereClause}
      GROUP BY c.estado
      ORDER BY count DESC
    `)

    // Distribution by vendedor (with concluded breakdown)
    const vendedorCounts = await prisma.$queryRaw<VendedorCount[]>(Prisma.sql`
      SELECT 
        p."vendedorId",
        v.name AS "vendedorName",
        COUNT(*)::int AS count,
        COALESCE(SUM(item_totals.subtotal), 0)::float AS "totalValor",
        COUNT(*) FILTER (WHERE p.status = 'CONCLUIDO'::"PedidoStatus")::int AS "countConcluido",
        COALESCE(SUM(item_totals.subtotal) FILTER (WHERE p.status = 'CONCLUIDO'::"PedidoStatus"), 0)::float AS "totalValorConcluido"
      FROM "Pedido" p
      JOIN "Client" c ON c.id = p."clienteId"
      JOIN "Orcamento" o ON o.id = p."orcamentoId"
      LEFT JOIN "User" v ON v.id = p."vendedorId"
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0) AS subtotal
        FROM "PedidoItem" pi
        WHERE pi."pedidoId" = p.id
      ) item_totals ON true
      ${whereClause}
      GROUP BY p."vendedorId", v.name
      ORDER BY count DESC
    `)

    return NextResponse.json({
      data: pedidos.map((ped) => ({
        id: ped.id,
        createdAt: ped.createdAt,
        status: ped.status,
        tipoEspecial: ped.tipoEspecial,
        geradoART: ped.geradoART,
        cliente: {
          id: ped.clienteId,
          razaoSocial: ped.clienteRazaoSocial,
          nomeSindico: ped.clienteNomeSindico,
          estado: ped.clienteEstado,
          cidade: ped.clienteCidade,
          bairro: ped.clienteBairro,
        },
        vendedor: ped.vendedorId
          ? { id: ped.vendedorId, name: ped.vendedorName }
          : null,
        empresa: ped.empresaId
          ? { id: ped.empresaId, nome: ped.empresaNome }
          : null,
        totalValor: ped.totalValor ?? 0,
        contratoId: ped.contratoId,
        isContratoVigente: ped.contratoStatus === 'OK' && ped.contratoDataFim && toDateInputValue(ped.contratoDataFim) >= toDateInputValue(new Date()),
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
        totalValueConcluido,
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
          countConcluido: item.countConcluido,
          totalValorConcluido: item.totalValorConcluido ?? 0,
        })),
      },
    })
  } catch (error) {
    console.error("[pedidos/list][GET]", error)
    return NextResponse.json(
      { error: "Erro ao buscar pedidos" },
      { status: 500 },
    )
  }
}

