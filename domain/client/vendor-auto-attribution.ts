/**
 * Atribuição Automática de Clientes ao Dashboard do Vendedor
 * 
 * Este módulo centraliza a lógica de atribuição automática de clientes
 * ao dashboard do vendedor. Usado pelo cron e pelo botão em "Análise de Vendedores".
 * 
 * Operações:
 * 1. Tornar visíveis ATIVOS/AGENDADOS que entraram na janela de aparição
 * 2. Tornar visíveis EXPLORADOS com vendedor
 * 3. Garantir que clientes sem vendedor não fiquem visíveis
 * 
 * IMPORTANTE: Só processa clientes que JÁ têm vendedorId settado.
 * Esta rota NÃO remove clientes do dashboard (isso é feito manualmente ou por perda).
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import {
  MESES_ANTECEDENCIA_ATIVOS,
  MESES_ANTECEDENCIA_AGENDADOS,
  deveAparecerAtivoDashboard,
  deveAparecerAgendadoDashboard,
} from "./vendor-dashboard-rules"
import type { ClientCategoria } from "./category-rules"
import { cleanupAllInactiveVendorsAssignments } from "./vendor-deactivation"
import { removerRenovadosDoDashboard, buscarRenovadosVisiveis } from "./renovado-rules"
import { MESES_RENOVADO } from "@/lib/client-status"
import { registrarHistoricoBatch } from "./vendor-history"

// ============================================================================
// TIPOS
// ============================================================================

export type ClienteParaAtribuicao = {
  id: number
  vendedorId: string
  vendedorNome?: string
  categoria: ClientCategoria | null
  razaoSocial: string
  cnpj: string
  ultimaManutencao: Date | null
}

export type VendedorPreview = {
  id: string
  nome: string
  clientes: {
    categoria: ClientCategoria
    quantidade: number
  }[]
  total: number
}

export type AtribuicaoPreview = {
  dataReferencia: string
  config: {
    mesesAntecedenciaAtivos: number
    mesesAntecedenciaAgendados: number
    mesesRenovado: number
  }
  entradasDashboard: {
    porVendedor: VendedorPreview[]
    porCategoria: {
      ativos: number
      agendados: number
      explorados: number
    }
    total: number
  }
  saidasDashboard: {
    renovados: number
  }
  clientesSemVendedorVisiveis: number
}

export type AtribuicaoResult = {
  success: boolean
  timestamp: string
  durationMs: number
  limpezaCautelar: {
    vendedoresProcessados: number
    clientesLiberados: number
  }
  renovadosRemovidos: {
    processados: number
    removidos: number
  }
  ativos: {
    processados: number
    atualizados: number
  }
  agendados: {
    processados: number
    atualizados: number
  }
  explorados: {
    processados: number
    atualizados: number
  }
  clientesSemVendedorResetados: number
  errors: string[]
}

// ============================================================================
// QUERIES AUXILIARES
// ============================================================================

async function buscarClientesParaAtribuicao(
  prisma: PrismaClient | Prisma.TransactionClient,
  categoria: "ATIVO" | "AGENDADO" | "EXPLORADO" | null
): Promise<ClienteParaAtribuicao[]> {
  const whereCategoria = categoria === "EXPLORADO"
    ? { OR: [{ categoria: "EXPLORADO" }, { categoria: null }] }
    : { categoria }

  return prisma.client.findMany({
    where: {
      ...whereCategoria,
      vendedorId: { not: null },
      visivelDashVendedor: false, // Só processar os que ainda não estão visíveis
      ...(categoria !== "EXPLORADO" ? { ultimaManutencao: { not: null } } : {}),
    },
    select: {
      id: true,
      vendedorId: true,
      categoria: true,
      razaoSocial: true,
      cnpj: true,
      ultimaManutencao: true,
      vendedor: {
        select: { name: true },
      },
    },
  }).then((clientes) =>
    clientes.map((c) => ({
      id: c.id,
      vendedorId: c.vendedorId!,
      vendedorNome: c.vendedor?.name ?? undefined,
      categoria: c.categoria as ClientCategoria | null,
      razaoSocial: c.razaoSocial,
      cnpj: c.cnpj,
      ultimaManutencao: c.ultimaManutencao,
    }))
  )
}

async function contarClientesSemVendedorVisiveis(
  prisma: PrismaClient | Prisma.TransactionClient
): Promise<number> {
  const result = await prisma.client.count({
    where: {
      vendedorId: null,
      visivelDashVendedor: true,
    },
  })
  return result
}

async function contarRenovadosVisiveis(
  prisma: PrismaClient | Prisma.TransactionClient,
  dataReferencia: Date = new Date()
): Promise<number> {
  const renovados = await buscarRenovadosVisiveis(prisma, dataReferencia)
  return renovados.length
}

// ============================================================================
// FUNÇÕES DE FILTRAGEM
// ============================================================================

function filtrarClientesNaJanela(
  clientes: ClienteParaAtribuicao[],
  categoria: "ATIVO" | "AGENDADO",
  dataReferencia: Date
): ClienteParaAtribuicao[] {
  return clientes.filter((cliente) => {
    if (!cliente.ultimaManutencao) return false

    if (categoria === "ATIVO") {
      return deveAparecerAtivoDashboard(cliente.ultimaManutencao, dataReferencia)
    } else {
      return deveAparecerAgendadoDashboard(cliente.ultimaManutencao, dataReferencia)
    }
  })
}

function agruparPorVendedor(clientes: ClienteParaAtribuicao[]): Map<string, ClienteParaAtribuicao[]> {
  const mapa = new Map<string, ClienteParaAtribuicao[]>()

  for (const cliente of clientes) {
    const vendedorId = cliente.vendedorId
    if (!mapa.has(vendedorId)) {
      mapa.set(vendedorId, [])
    }
    mapa.get(vendedorId)!.push(cliente)
  }

  return mapa
}

function gerarVendedorPreview(
  vendedorId: string,
  clientes: ClienteParaAtribuicao[]
): VendedorPreview {
  const porCategoria = new Map<ClientCategoria, number>()
  let vendedorNome = "Vendedor"

  for (const cliente of clientes) {
    const cat = (cliente.categoria ?? "EXPLORADO") as ClientCategoria
    porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + 1)
    if (cliente.vendedorNome) {
      vendedorNome = cliente.vendedorNome
    }
  }

  return {
    id: vendedorId,
    nome: vendedorNome,
    clientes: Array.from(porCategoria.entries()).map(([categoria, quantidade]) => ({
      categoria,
      quantidade,
    })),
    total: clientes.length,
  }
}

// ============================================================================
// PREVIEW - Mostra o que vai acontecer sem executar
// ============================================================================

export async function previewAtribuicao(
  prisma: PrismaClient | Prisma.TransactionClient,
  dataReferencia: Date = new Date()
): Promise<AtribuicaoPreview> {
  // Buscar todos os clientes candidatos e renovados
  const [clientesAtivos, clientesAgendados, clientesExplorados, semVendedorVisiveis, renovadosVisiveis] = await Promise.all([
    buscarClientesParaAtribuicao(prisma, "ATIVO"),
    buscarClientesParaAtribuicao(prisma, "AGENDADO"),
    buscarClientesParaAtribuicao(prisma, "EXPLORADO"),
    contarClientesSemVendedorVisiveis(prisma),
    contarRenovadosVisiveis(prisma, dataReferencia),
  ])

  // Filtrar os que estão na janela de aparição
  const ativosNaJanela = filtrarClientesNaJanela(clientesAtivos, "ATIVO", dataReferencia)
  const agendadosNaJanela = filtrarClientesNaJanela(clientesAgendados, "AGENDADO", dataReferencia)
  // Explorados sempre aparecem (não precisam de filtro de janela)
  const exploradosParaAparecer = clientesExplorados

  // Combinar todos
  const todosParaAparecer = [...ativosNaJanela, ...agendadosNaJanela, ...exploradosParaAparecer]

  // Agrupar por vendedor
  const porVendedor = agruparPorVendedor(todosParaAparecer)

  // Gerar preview por vendedor
  const vendedoresPreview: VendedorPreview[] = []
  for (const [vendedorId, clientes] of porVendedor) {
    vendedoresPreview.push(gerarVendedorPreview(vendedorId, clientes))
  }

  // Ordenar por total de clientes (decrescente)
  vendedoresPreview.sort((a, b) => b.total - a.total)

  return {
    dataReferencia: dataReferencia.toISOString(),
    config: {
      mesesAntecedenciaAtivos: MESES_ANTECEDENCIA_ATIVOS,
      mesesAntecedenciaAgendados: MESES_ANTECEDENCIA_AGENDADOS,
      mesesRenovado: MESES_RENOVADO,
    },
    entradasDashboard: {
      porVendedor: vendedoresPreview,
      porCategoria: {
        ativos: ativosNaJanela.length,
        agendados: agendadosNaJanela.length,
        explorados: exploradosParaAparecer.length,
      },
      total: todosParaAparecer.length,
    },
    saidasDashboard: {
      renovados: renovadosVisiveis,
    },
    clientesSemVendedorVisiveis: semVendedorVisiveis,
  }
}

// ============================================================================
// EXECUÇÃO - Aplica a atribuição
// ============================================================================

export async function executarAtribuicao(
  prisma: PrismaClient,
  dataReferencia: Date = new Date()
): Promise<AtribuicaoResult> {
  const startTime = Date.now()

  const result: AtribuicaoResult = {
    success: true,
    timestamp: dataReferencia.toISOString(),
    durationMs: 0,
    limpezaCautelar: { vendedoresProcessados: 0, clientesLiberados: 0 },
    renovadosRemovidos: { processados: 0, removidos: 0 },
    ativos: { processados: 0, atualizados: 0 },
    agendados: { processados: 0, atualizados: 0 },
    explorados: { processados: 0, atualizados: 0 },
    clientesSemVendedorResetados: 0,
    errors: [],
  }

  try {
    // ========================================
    // LIMPEZA CAUTELAR - Remover atribuições de vendedores inativos
    // ========================================
    // Garante que nenhum cliente fique atribuído a um vendedor inativo
    // antes de processar as novas atribuições
    const limpezaResult = await cleanupAllInactiveVendorsAssignments(prisma)
    result.limpezaCautelar = {
      vendedoresProcessados: limpezaResult.vendedoresProcessados,
      clientesLiberados: limpezaResult.totalClientesLiberados,
    }

    // ========================================
    // REMOVER RENOVADOS DO DASHBOARD
    // ========================================
    // Clientes ATIVOS com ultimaManutencao < MESES_RENOVADO meses
    // já foram atendidos e não precisam mais estar visíveis
    const renovadosResult = await removerRenovadosDoDashboard(prisma, dataReferencia)
    result.renovadosRemovidos = {
      processados: renovadosResult.processados,
      removidos: renovadosResult.removidos,
    }

    // ========================================
    // PROCESSAR ATIVOS - BULK
    // ========================================
    const clientesAtivos = await buscarClientesParaAtribuicao(prisma, "ATIVO")
    result.ativos.processados = clientesAtivos.length

    const ativosNaJanela = filtrarClientesNaJanela(clientesAtivos, "ATIVO", dataReferencia)
    if (ativosNaJanela.length > 0) {
      try {
        const ativosIds = ativosNaJanela.map((c) => c.id)
        // Uma única query para atualizar TODOS os ativos
        await prisma.client.updateMany({
          where: { id: { in: ativosIds } },
          data: { visivelDashVendedor: true },
        })
        // Uma única query para registrar histórico de TODOS
        const ativosHistorico = ativosNaJanela.map((c) => ({
          clientId: c.id,
          vendedorId: c.vendedorId,
          type: "INDASH" as const,
          category: "ATIVO" as ClientCategoria,
          reason: `[ATIVO] Atribuição automática: cliente aparece ${MESES_ANTECEDENCIA_ATIVOS} meses antes do vencimento`,
        }))
        await registrarHistoricoBatch(prisma, ativosHistorico)
        result.ativos.atualizados = ativosNaJanela.length
      } catch (error) {
        result.errors.push(`Erro ao atualizar ATIVOS: ${error}`)
      }
    }

    // ========================================
    // PROCESSAR AGENDADOS - BULK
    // ========================================
    const clientesAgendados = await buscarClientesParaAtribuicao(prisma, "AGENDADO")
    result.agendados.processados = clientesAgendados.length

    const agendadosNaJanela = filtrarClientesNaJanela(clientesAgendados, "AGENDADO", dataReferencia)
    if (agendadosNaJanela.length > 0) {
      try {
        const agendadosIds = agendadosNaJanela.map((c) => c.id)
        // Uma única query para atualizar TODOS os agendados
        await prisma.client.updateMany({
          where: { id: { in: agendadosIds } },
          data: { visivelDashVendedor: true },
        })
        // Uma única query para registrar histórico de TODOS
        const agendadosHistorico = agendadosNaJanela.map((c) => ({
          clientId: c.id,
          vendedorId: c.vendedorId,
          type: "INDASH" as const,
          category: "AGENDADO" as ClientCategoria,
          reason: `[AGENDADO] Atribuição automática: cliente aparece ${MESES_ANTECEDENCIA_AGENDADOS} meses antes do vencimento`,
        }))
        await registrarHistoricoBatch(prisma, agendadosHistorico)
        result.agendados.atualizados = agendadosNaJanela.length
      } catch (error) {
        result.errors.push(`Erro ao atualizar AGENDADOS: ${error}`)
      }
    }

    // ========================================
    // PROCESSAR EXPLORADOS - BULK
    // ========================================
    const clientesExplorados = await buscarClientesParaAtribuicao(prisma, "EXPLORADO")
    result.explorados.processados = clientesExplorados.length

    if (clientesExplorados.length > 0) {
      try {
        const exploradosIds = clientesExplorados.map((c) => c.id)
        // Uma única query para atualizar TODOS os explorados
        await prisma.client.updateMany({
          where: { id: { in: exploradosIds } },
          data: { visivelDashVendedor: true },
        })
        // Uma única query para registrar histórico de TODOS
        const exploradosHistorico = clientesExplorados.map((c) => ({
          clientId: c.id,
          vendedorId: c.vendedorId,
          type: "INDASH" as const,
          category: "EXPLORADO" as ClientCategoria,
          reason: `[EXPLORADO] Atribuição automática: cliente EXPLORADO com vendedor`,
        }))
        await registrarHistoricoBatch(prisma, exploradosHistorico)
        result.explorados.atualizados = clientesExplorados.length
      } catch (error) {
        result.errors.push(`Erro ao atualizar EXPLORADOS: ${error}`)
      }
    }

    // ========================================
    // RESETAR CLIENTES SEM VENDEDOR - BULK
    // ========================================
    const resetados = await prisma.client.updateMany({
      where: {
        vendedorId: null,
        visivelDashVendedor: true,
      },
      data: {
        visivelDashVendedor: false,
      },
    })
    result.clientesSemVendedorResetados = resetados.count
  } catch (error) {
    result.success = false
    result.errors.push(`Erro fatal: ${error instanceof Error ? error.message : String(error)}`)
  }

  result.durationMs = Date.now() - startTime
  return result
}

