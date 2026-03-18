import { NextResponse } from "next/server"
import { PedidoStatus, ClientCategoria } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { isClienteRenovado, isClienteVencido } from "@/lib/client-status"

export type ClienteDoVendedor = {
  id: number
  cnpj: string
  razaoSocial: string
  categoria: string | null
  cidade: string | null
  estado: string | null
  vendedorAlocadoEm: string | null
  ultimaManutencao: string | null
  isVencido: boolean
  visivelDashVendedor: boolean // Se o cliente está visível no dashboard do vendedor
  // tempoAlocacao e diasAlocado são calculados no frontend com base em vendedorAlocadoEm
}

export type DistribuicaoCategoria = {
  categoria: string
  total: number
}

export type DistribuicaoTempoAlocacao = {
  faixa: string
  total: number
  porCategoria: Record<string, number>
}

export type VendedorAnaliseDetalhada = {
  id: string
  nome: string
  totalPedidos: number
  totalVendas: number
  vendasMesAtual: number // Vendas do mês atual (exceto cancelados)
  totalClientes: number
  clientesVencidos: number
  clientesNoDashboard: number // Clientes com visivelDashVendedor = true
  clientesForaDashboard: number // Clientes com visivelDashVendedor = false
  orcadosNoDashboard: number // Clientes no dashboard com orçamento < 2 meses
  distribuicaoCategoria: DistribuicaoCategoria[]
  distribuicaoCategoriaNoDash: DistribuicaoCategoria[] // Apenas clientes no dashboard
  distribuicaoTempoAlocacao: DistribuicaoTempoAlocacao[]
  clientes: ClienteDoVendedor[]
}

function mapCategoria(cat: ClientCategoria | null): string {
  if (!cat) return "Não definido"
  const map: Record<ClientCategoria, string> = {
    ATIVO: "Ativo",
    AGENDADO: "Agendado",
    EXPLORADO: "Explorado",
  }
  return map[cat] ?? "Não definido"
}

// Calcula a faixa de tempo de alocação baseado na data de alocação
function calcularFaixaTempoAlocacao(vendedorAlocadoEm: Date | null): string {
  if (!vendedorAlocadoEm) return "Não informado"

  const now = new Date()
  const diffMs = now.getTime() - vendedorAlocadoEm.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 7) return "< 1 semana"
  if (diffDays < 14) return "1-2 semanas"
  if (diffDays < 30) return "2 sem - 1 mês"
  if (diffDays < 60) return "1-2 meses"
  if (diffDays < 90) return "2-3 meses"
  return "> 3 meses"
}

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/vendedores/[id]/analise
 * Retorna análise detalhada de um vendedor específico
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: vendedorId } = await params

    // Buscar vendedor
    const vendedor = await prisma.user.findUnique({
      where: { id: vendedorId },
      select: { id: true, name: true },
    })

    if (!vendedor) {
      return NextResponse.json({ error: "Vendedor não encontrado" }, { status: 404 })
    }

    // Buscar estatísticas de pedidos (total)
    const pedidoStats = await prisma.$queryRaw<
      Array<{ total_pedidos: bigint; total_vendas: number }>
    >`
      SELECT 
        COUNT(DISTINCT p.id) as total_pedidos,
        COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0) as total_vendas
      FROM "Pedido" p
      LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
      WHERE p.status::text NOT IN (${PedidoStatus.CANCELADO}, ${PedidoStatus.ANALISE_CANCELAMENTO}, ${PedidoStatus.ANALISE_CANCELAMENTO_SUPERVISAO})
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
        AND p."vendedorId" = ${vendedorId}
    `

    const stats = pedidoStats[0] ?? { total_pedidos: BigInt(0), total_vendas: 0 }

    // Buscar vendas do mês atual
    const now = new Date()
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
    const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const vendasMesStats = await prisma.$queryRaw<
      Array<{ total_vendas: number }>
    >`
      SELECT 
        COALESCE(SUM(pi.quantidade * pi."valorUnitarioPraticado"), 0) as total_vendas
      FROM "Pedido" p
      LEFT JOIN "PedidoItem" pi ON pi."pedidoId" = p.id
      WHERE p.status::text NOT IN (${PedidoStatus.CANCELADO}, ${PedidoStatus.ANALISE_CANCELAMENTO}, ${PedidoStatus.ANALISE_CANCELAMENTO_SUPERVISAO})
        AND (p."tipoEspecial" IS NULL OR p."tipoEspecial" != 'OS')
        AND p."vendedorId" = ${vendedorId}
        AND p."createdAt" >= ${inicioMes}
        AND p."createdAt" <= ${fimMes}
    `

    const vendasMesAtual = Number(vendasMesStats[0]?.total_vendas ?? 0)

    // Buscar clientes do vendedor
    const clientesRaw = await prisma.client.findMany({
      where: { vendedorId },
      select: {
        id: true,
        cnpj: true,
        razaoSocial: true,
        categoria: true,
        cidade: true,
        estado: true,
        vendedorAlocadoEm: true,
        ultimaManutencao: true,
        visivelDashVendedor: true,
      },
      orderBy: { razaoSocial: "asc" },
    })

    // Processar clientes (tempoAlocacao e diasAlocado são calculados no frontend)
    const clientes: ClienteDoVendedor[] = clientesRaw.map((c) => ({
      id: c.id,
      cnpj: c.cnpj,
      razaoSocial: c.razaoSocial,
      categoria: mapCategoria(c.categoria),
      cidade: c.cidade,
      estado: c.estado,
      vendedorAlocadoEm: c.vendedorAlocadoEm?.toISOString() ?? null,
      ultimaManutencao: c.ultimaManutencao?.toISOString() ?? null,
      isVencido: isClienteVencido(c.categoria, c.ultimaManutencao),
      visivelDashVendedor: c.visivelDashVendedor ?? false,
    }))

    // Separar clientes no dashboard e fora (agora todos aparecem no dash por regra)
    const clientesNoDashboard = clientes.length
    const clientesForaDashboard = 0

    // Contar clientes no dashboard com orçamento criado há menos de 2 meses
    const doisMesesAtras = new Date()
    doisMesesAtras.setMonth(doisMesesAtras.getMonth() - 2)

    const orcadosNoDashboardResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT c.id) as count
      FROM "Client" c
      INNER JOIN "Orcamento" o ON o."clienteId" = c.id
      WHERE c."vendedorId" = ${vendedorId}
        AND o."createdAt" >= ${doisMesesAtras}
    `
    const orcadosNoDashboard = Number(orcadosNoDashboardResult[0]?.count ?? 0)

    // Calcular distribuição por categoria (todos os clientes)
    // - Ativos: separa em "A Renovar" ou "Renovado" (nunca Vencido)
    // - Não-ativos: pode ser "Vencido" se expirou, senão mantém categoria original
    const calcularDistribuicaoDetalhada = (clientesList: typeof clientes) => {
      const map = new Map<string, number>()
      for (const c of clientesList) {
        let cat: string
        if (c.categoria === "Ativo") {
          if (c.isVencido) {
            cat = "Vencido"
          } else {
            cat = isClienteRenovado(c.ultimaManutencao) ? "Renovado" : "A Renovar"
          }
        } else {
          cat = c.categoria ?? "Não definido"
        }
        map.set(cat, (map.get(cat) ?? 0) + 1)
      }
      return Array.from(map.entries()).map(([categoria, total]) => ({ categoria, total }))
    }

    const distribuicaoCategoria: DistribuicaoCategoria[] = calcularDistribuicaoDetalhada(clientes)

    // Calcular distribuição por categoria (apenas clientes NO DASHBOARD - agora todos)
    const distribuicaoCategoriaNoDash: DistribuicaoCategoria[] = distribuicaoCategoria

    // Calcular distribuição por tempo de alocação
    const faixasOrdem = ["< 1 semana", "1-2 semanas", "2 sem - 1 mês", "1-2 meses", "2-3 meses", "> 3 meses", "Não informado"]
    const distribuicaoTempoMap = new Map<string, { total: number; porCategoria: Record<string, number> }>()

    for (const faixa of faixasOrdem) {
      distribuicaoTempoMap.set(faixa, { total: 0, porCategoria: {} })
    }

    for (const c of clientesRaw) {
      const faixa = calcularFaixaTempoAlocacao(c.vendedorAlocadoEm)
      const entry = distribuicaoTempoMap.get(faixa) ?? { total: 0, porCategoria: {} }
      entry.total++
      const cat = mapCategoria(c.categoria)
      entry.porCategoria[cat] = (entry.porCategoria[cat] ?? 0) + 1
      distribuicaoTempoMap.set(faixa, entry)
    }

    const distribuicaoTempoAlocacao: DistribuicaoTempoAlocacao[] = faixasOrdem
      .map((faixa) => ({
        faixa,
        ...(distribuicaoTempoMap.get(faixa) ?? { total: 0, porCategoria: {} }),
      }))
      .filter((d) => d.total > 0)

    // Contar clientes vencidos
    const clientesVencidos = clientes.filter((c) => c.isVencido).length

    const data: VendedorAnaliseDetalhada = {
      id: vendedor.id,
      nome: vendedor.name,
      totalPedidos: Number(stats.total_pedidos),
      totalVendas: Number(stats.total_vendas) || 0,
      vendasMesAtual,
      totalClientes: clientes.length,
      clientesVencidos,
      clientesNoDashboard,
      clientesForaDashboard,
      orcadosNoDashboard,
      distribuicaoCategoria,
      distribuicaoCategoriaNoDash,
      distribuicaoTempoAlocacao,
      clientes,
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("[vendedores][id][analise][GET]", error)
    const message = error instanceof Error ? error.message : "Erro ao buscar análise do vendedor"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

