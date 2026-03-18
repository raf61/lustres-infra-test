import { NextResponse } from "next/server"
import { PedidoStatus, Role } from "@prisma/client"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { createPeriodRange, getNowBrazil, type PeriodType } from "@/lib/date-utils"

export type VendedorAnaliseResumo = {
  id: string
  nome: string
  totalPedidos: number
  totalVendas: number
  active: boolean
  // Distribuição por categoria do cliente no momento da venda
  distribuicaoPorCategoria?: { categoria: string; quantidade: number; valor: number }[]
}

type VendasExtrasStats = {
  totalPedidos: number
  totalVendas: number
}

type DistribuicaoCategoria = {
  categoria: string
  quantidade: number
  valor: number
}

/**
 * GET /api/vendedores/analise
 * Retorna lista de vendedores com estatísticas básicas (total pedidos e valor de vendas)
 * Considera apenas pedidos com status != CANCELADO
 * 
 * Query params:
 * - periodo: "mes" (default) | "trimestre" | "semestre" | "ano" | "total"
 * - mes: número do mês (1-12), default = mês atual
 * - ano: ano, default = ano atual
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get("periodo") ?? "mes"
    const mesParam = searchParams.get("mes")
    const anoParam = searchParams.get("ano")

    // Obter mês e ano atual no Brasil usando a lib date-utils
    const nowBrazil = getNowBrazil()
    const mesAtual = mesParam ? parseInt(mesParam, 10) : nowBrazil.month
    const anoAtual = anoParam ? parseInt(anoParam, 10) : nowBrazil.year

    // Calcular intervalo de datas usando a lib date-utils
    // Retorna intervalo fechado-aberto: >= startDate AND < endDate
    const { startDate: dataInicio, endDate: dataFim } = createPeriodRange(periodo as PeriodType, mesAtual, anoAtual)

    // Buscar vendedores ativos
    const vendedores = await prisma.user.findMany({
      where: {
        role: Role.VENDEDOR,
        active: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    })

    // Buscar estatísticas de pedidos por vendedor com filtro de período
    // Usando intervalo fechado-aberto: >= dataInicio AND < dataFim
    const stats = await prisma.$queryRaw<
      Array<{
        vendedor_id: string
        total_pedidos: bigint
        total_vendas: number
      }>
    >`
      SELECT 
        p."vendedorId" as vendedor_id,
        COUNT(DISTINCT p.id) as total_pedidos,
        COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0) as total_vendas
      FROM "Pedido" p
      LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
      WHERE p.status::text != ${PedidoStatus.CANCELADO}
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
        AND p."vendedorId" IS NOT NULL
        AND p."createdAt" >= ${dataInicio}
        AND p."createdAt" < ${dataFim}
      GROUP BY p."vendedorId"
    `

    // Mapear stats para um objeto para fácil lookup
    const statsMap = new Map<string, { totalPedidos: number; totalVendas: number }>()
    for (const row of stats) {
      statsMap.set(row.vendedor_id, {
        totalPedidos: Number(row.total_pedidos),
        totalVendas: Number(row.total_vendas) || 0,
      })
    }

    // Buscar distribuição por categoria do cliente no momento da venda (por vendedor)
    const distribuicaoPorCategoriaResult = await prisma.$queryRaw<
      Array<{
        vendedor_id: string
        categoria: string | null
        quantidade: bigint
        valor: number
      }>
    >`
      SELECT 
        p."vendedorId" as vendedor_id,
        p."categoriaClienteNoMomento"::text as categoria,
        COUNT(DISTINCT p.id) as quantidade,
        COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0) as valor
      FROM "Pedido" p
      LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
      WHERE p.status::text != ${PedidoStatus.CANCELADO}
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
        AND p."vendedorId" IS NOT NULL
        AND p."createdAt" >= ${dataInicio}
        AND p."createdAt" < ${dataFim}
      GROUP BY p."vendedorId", p."categoriaClienteNoMomento"
      ORDER BY quantidade DESC
    `

    // Mapear distribuição por vendedor
    const distribuicaoMap = new Map<string, DistribuicaoCategoria[]>()
    for (const row of distribuicaoPorCategoriaResult) {
      if (!distribuicaoMap.has(row.vendedor_id)) {
        distribuicaoMap.set(row.vendedor_id, [])
      }
      distribuicaoMap.get(row.vendedor_id)!.push({
        categoria: row.categoria ?? "SEM_CATEGORIA",
        quantidade: Number(row.quantidade),
        valor: Number(row.valor) || 0,
      })
    }

    // Combinar vendedores com suas stats
    const data: VendedorAnaliseResumo[] = vendedores.map((vendedor) => {
      const vendedorStats = statsMap.get(vendedor.id) ?? { totalPedidos: 0, totalVendas: 0 }
      return {
        id: vendedor.id,
        nome: vendedor.name,
        totalPedidos: vendedorStats.totalPedidos,
        totalVendas: vendedorStats.totalVendas,
        active: true,
        distribuicaoPorCategoria: distribuicaoMap.get(vendedor.id) ?? [],
      }
    })

    // Ordenar por total de vendas (descendente)
    data.sort((a, b) => b.totalVendas - a.totalVendas)

    // IDs dos vendedores ativos (para excluir nas queries de "extras")
    const vendedoresAtivosIds = vendedores.map((v) => v.id)

    // Buscar estatísticas de pedidos SEM vendedor (vendedorId IS NULL)
    const semVendedorResult = await prisma.$queryRaw<
      Array<{
        total_pedidos: bigint
        total_vendas: number
      }>
    >`
      SELECT 
        COUNT(DISTINCT p.id) as total_pedidos,
        COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0) as total_vendas
      FROM "Pedido" p
      LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
      WHERE p.status::text != ${PedidoStatus.CANCELADO}
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
        AND p."vendedorId" IS NULL
        AND p."createdAt" >= ${dataInicio}
        AND p."createdAt" < ${dataFim}
    `

    const semVendedor: VendasExtrasStats = {
      totalPedidos: Number(semVendedorResult[0]?.total_pedidos ?? 0),
      totalVendas: Number(semVendedorResult[0]?.total_vendas ?? 0),
    }

    // Buscar estatísticas de VENDEDORES INATIVOS (vendedores com vendas mas que não estão ativos)
    // Retornar cada vendedor individualmente em vez de agregar
    let vendedoresInativos: VendedorAnaliseResumo[] = []

    // Buscar vendedores inativos que tiveram vendas no período
    const vendedoresInativosComVendas = await prisma.$queryRaw<
      Array<{
        vendedor_id: string
        vendedor_nome: string
        total_pedidos: bigint
        total_vendas: number
      }>
    >`
      SELECT 
        p."vendedorId" as vendedor_id,
        u."name" as vendedor_nome,
        COUNT(DISTINCT p.id) as total_pedidos,
        COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0) as total_vendas
      FROM "Pedido" p
      INNER JOIN "User" u ON u."id" = p."vendedorId"
      LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
      WHERE p.status::text != ${PedidoStatus.CANCELADO}
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
        AND p."vendedorId" IS NOT NULL
        AND u."active" = false
        AND p."createdAt" >= ${dataInicio}
        AND p."createdAt" < ${dataFim}
      GROUP BY p."vendedorId", u."name"
      ORDER BY total_vendas DESC
    `

    // Buscar distribuição por categoria para cada vendedor inativo
    const inativosIds = vendedoresInativosComVendas.map(v => v.vendedor_id)

    if (inativosIds.length > 0) {
      const distribuicaoInativosResult = await prisma.$queryRaw<
        Array<{
          vendedor_id: string
          categoria: string | null
          quantidade: bigint
          valor: number
        }>
      >`
        SELECT 
          p."vendedorId" as vendedor_id,
          p."categoriaClienteNoMomento"::text as categoria,
          COUNT(DISTINCT p.id) as quantidade,
          COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0) as valor
        FROM "Pedido" p
        LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
        WHERE p.status::text != ${PedidoStatus.CANCELADO}
          AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
          AND p."vendedorId" IN (${Prisma.join(inativosIds)})
          AND p."createdAt" >= ${dataInicio}
          AND p."createdAt" < ${dataFim}
        GROUP BY p."vendedorId", p."categoriaClienteNoMomento"
        ORDER BY quantidade DESC
      `

      // Mapear distribuição por vendedor inativo
      const distribuicaoInativosMap = new Map<string, DistribuicaoCategoria[]>()
      for (const row of distribuicaoInativosResult) {
        if (!distribuicaoInativosMap.has(row.vendedor_id)) {
          distribuicaoInativosMap.set(row.vendedor_id, [])
        }
        distribuicaoInativosMap.get(row.vendedor_id)!.push({
          categoria: row.categoria ?? "SEM_CATEGORIA",
          quantidade: Number(row.quantidade),
          valor: Number(row.valor) || 0,
        })
      }

      vendedoresInativos = vendedoresInativosComVendas.map((v) => ({
        id: v.vendedor_id,
        nome: v.vendedor_nome,
        totalPedidos: Number(v.total_pedidos),
        totalVendas: Number(v.total_vendas) || 0,
        active: false,
        distribuicaoPorCategoria: distribuicaoInativosMap.get(v.vendedor_id) ?? [],
      }))
    }

    // Calcular distribuição total por categoria (todos os vendedores)
    const distribuicaoTotalResult = await prisma.$queryRaw<
      Array<{
        categoria: string | null
        quantidade: bigint
        valor: number
      }>
    >`
      SELECT 
        p."categoriaClienteNoMomento"::text as categoria,
        COUNT(DISTINCT p.id) as quantidade,
        COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0) as valor
      FROM "Pedido" p
      LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
      WHERE p.status::text != ${PedidoStatus.CANCELADO}
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
        AND p."createdAt" >= ${dataInicio}
        AND p."createdAt" < ${dataFim}
      GROUP BY p."categoriaClienteNoMomento"
      ORDER BY quantidade DESC
    `

    const distribuicaoTotal: DistribuicaoCategoria[] = distribuicaoTotalResult.map((row) => ({
      categoria: row.categoria ?? "SEM_CATEGORIA",
      quantidade: Number(row.quantidade),
      valor: Number(row.valor) || 0,
    }))

    return NextResponse.json({
      data,
      semVendedor,
      vendedoresInativos,
      distribuicaoTotal, // Distribuição total por categoria (todas as vendas)
      meta: {
        periodo,
        mes: mesAtual,
        ano: anoAtual,
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
      }
    })
  } catch (error) {
    console.error("[vendedores][analise][GET]", error)
    const message = error instanceof Error ? error.message : "Erro ao buscar análise de vendedores"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

