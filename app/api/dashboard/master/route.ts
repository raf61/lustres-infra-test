import { NextResponse } from "next/server"
import { ClientCategoria, PedidoStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getNowBrazil, createBrazilDate } from "@/lib/date-utils"
import { countMandatosVencendoNoMes } from "@/domain/client/mandato-usecase"

/**
 * API Route para o Dashboard Master
 * 
 * Centraliza os dados agregados necessários para o dashboard principal.
 * Cada métrica é calculada de forma independente para facilitar manutenção.
 */

type InadimplenciaData = {
  total: number      // Valor total em reais
  quantidade: number // Quantidade de débitos vencidos
}

type DashboardMasterResponse = {
  inadimplencia: InadimplenciaData
  clientes: {
    livresSemData: number
    livresComData: number
    ativos: number
  }
  vendasMes: number
  leadsHoje: number
  vencidos: number
}

/**
 * Calcula a inadimplência total (débitos vencidos não pagos)
 * Vencido = stats === 0 (pendente) E vencimento < hoje
 */
async function getInadimplencia(): Promise<InadimplenciaData> {
  const { year, month, day } = getNowBrazil()
  const hoje = createBrazilDate(year, month, day)

  const result = await prisma.debito.aggregate({
    where: {
      stats: 0,              // Pendente (não pago, não cancelado)
      vencimento: { lt: hoje }, // Vencimento anterior a hoje
    },
    _sum: { receber: true },
    _count: true,
  })

  return {
    total: result._sum.receber ?? 0,
    quantidade: result._count ?? 0,
  }
}

async function getClientesResumo() {
  const [livresSemData, livresComData, ativos] = await Promise.all([
    prisma.client.count({ where: { categoria: ClientCategoria.EXPLORADO } }),
    prisma.client.count({ where: { categoria: ClientCategoria.AGENDADO } }),
    prisma.client.count({ where: { categoria: ClientCategoria.ATIVO } }),
  ])

  return { livresSemData, livresComData, ativos }
}

async function getLeadsHoje(): Promise<number> {
  const { year, month, day } = getNowBrazil()
  const hojeInicio = createBrazilDateStart(year, month, day)

  return await prisma.client.count({
    where: {
      createdAt: { gte: hojeInicio }
    }
  })
}

async function getVencidos(): Promise<number> {
  // Clientes ATIVOS vencidos
  const now = new Date()
  // Simplificando regra para o demo: ativos cuja última manutenção foi há mais de 1 ano
  const umAnoAtras = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)

  return await prisma.client.count({
    where: {
      categoria: ClientCategoria.ATIVO,
      ultimaManutencao: { lt: umAnoAtras }
    }
  })
}

async function getVendasMes(): Promise<number> {
  const now = new Date()
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
  const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const vendasMesStats = await prisma.$queryRaw<Array<{ total_vendas: number }>>`
    SELECT 
      COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0) as total_vendas
    FROM "Pedido" p
    LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
    WHERE p.status::text != ${PedidoStatus.CANCELADO}
      AND p."createdAt" >= ${inicioMes}
      AND p."createdAt" <= ${fimMes}
  `

  return Number(vendasMesStats[0]?.total_vendas ?? 0)
}

export async function GET() {
  try {
    const [inadimplencia, clientes, vendasMes, leadsHoje, vencidos] = await Promise.all([
      getInadimplencia(),
      getClientesResumo(),
      getVendasMes(),
      getLeadsHoje(),
      getVencidos(),
    ])

    const response: DashboardMasterResponse = {
      inadimplencia,
      clientes,
      vendasMes,
      leadsHoje,
      vencidos,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[dashboard][master][GET]", error)
    return NextResponse.json(
      { error: "Erro ao carregar dados do dashboard" },
      { status: 500 }
    )
  }
}
