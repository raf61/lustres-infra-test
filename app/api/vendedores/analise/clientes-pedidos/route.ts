import { NextResponse } from "next/server"
import { PedidoStatus } from "@prisma/client"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { createPeriodRange, type PeriodType } from "@/lib/date-utils"

type ClientePedido = {
  clienteId: number
  cnpj: string
  razaoSocial: string
  bairro: string | null
  cidade: string | null
  estado: string | null
  categoria: string | null
  vendedorAtualId: string | null
  vendedorAtualNome: string | null
  totalPedidos: number
  totalValor: number
}

/**
 * GET /api/vendedores/analise/clientes-pedidos
 * Retorna lista de clientes que tiveram pedidos de um vendedor específico no período
 * Agrupa pedidos por cliente, somando valores
 * 
 * Query params:
 * - vendedorId: ID do vendedor (obrigatório)
 * - periodo: "mes" (default) | "trimestre" | "semestre" | "ano" | "total"
 * - mes: número do mês (1-12), default = mês atual
 * - ano: ano, default = ano atual
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const vendedorId = searchParams.get("vendedorId")
    const periodo = searchParams.get("periodo") ?? "mes"
    const mesParam = searchParams.get("mes")
    const anoParam = searchParams.get("ano")

    if (!vendedorId) {
      return NextResponse.json({ error: "vendedorId é obrigatório" }, { status: 400 })
    }

    // Obter mês e ano atual
    const now = new Date()
    const mesAtual = mesParam ? parseInt(mesParam, 10) : now.getMonth() + 1
    const anoAtual = anoParam ? parseInt(anoParam, 10) : now.getFullYear()

    // Calcular intervalo de datas
    const { startDate: dataInicio, endDate: dataFim } = createPeriodRange(periodo as PeriodType, mesAtual, anoAtual)

    // Buscar clientes com pedidos do vendedor no período, agrupando valores
    const clientesPedidos = await prisma.$queryRaw<ClientePedido[]>`
      SELECT 
        c.id as "clienteId",
        c.cnpj,
        c."razaoSocial",
        c.bairro,
        c.cidade,
        c.estado,
        c.categoria::text as categoria,
        c."vendedorId" as "vendedorAtualId",
        v.name as "vendedorAtualNome",
        COUNT(DISTINCT p.id)::int as "totalPedidos",
        COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0)::float as "totalValor"
      FROM "Pedido" p
      INNER JOIN "Client" c ON c.id = p."clienteId"
      LEFT JOIN "User" v ON v.id = c."vendedorId"
      LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
      WHERE p."vendedorId" = ${vendedorId}
        AND p.status::text != ${PedidoStatus.CANCELADO}
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
        AND p."createdAt" >= ${dataInicio}
        AND p."createdAt" < ${dataFim}
      GROUP BY c.id, c.cnpj, c."razaoSocial", c.bairro, c.cidade, c.estado, c.categoria, c."vendedorId", v.name
      ORDER BY "totalValor" DESC
    `

    return NextResponse.json({
      data: clientesPedidos,
      meta: {
        vendedorId,
        periodo,
        mes: mesAtual,
        ano: anoAtual,
        total: clientesPedidos.length,
      }
    })
  } catch (error) {
    console.error("[vendedores/analise/clientes-pedidos][GET]", error)
    const message = error instanceof Error ? error.message : "Erro ao buscar clientes dos pedidos"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

