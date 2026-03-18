/**
 * Rota CRON para atualizar a visibilidade dos clientes no dashboard do vendedor.
 * 
 * Esta rota deve ser chamada mensalmente (início do mês).
 * 
 * Trabalhamos com MESES, não datas específicas!
 * 
 * Regras:
 * - ATIVOS: aparecem 2 meses antes do MÊS de vencimento
 *   Exemplo: ultimoPedido = Jan/2025 → Vencimento = Fev/2026 → Aparece em Dez/2025
 *   Total: 3 meses inteiros de trabalho (Dez + Jan + Fev)
 * 
 * - AGENDADOS (livres com data): mesma lógica dos ATIVOS, baseado em ultimaManutencao
 * 
 * - EXPLORADOS (livres sem data): sempre aparecem se tiverem vendedorId
 * 
 * IMPORTANTE: Só processa clientes que têm vendedorId settado.
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  MESES_ANTECEDENCIA_ATIVOS,
  MESES_ANTECEDENCIA_AGENDADOS,
  deveAparecerAtivoDashboard,
  deveAparecerAgendadoDashboard,
  makeClientsVisibleInDashboardBatch,
} from "@/domain/client/vendor-dashboard-rules"
import type { ClientCategoria } from "@/domain/client/category-rules"

async function runDashboardVendedorCron(_request: Request) {
  // Verificar autorização (opcional - pode ser feito via header ou token)
  //   const authHeader = request.headers.get("authorization")
  //   const cronSecret = process.env.CRON_SECRET

  //   // Se CRON_SECRET estiver definido, verificar autorização
  //   if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  //     return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  //   }

  const startTime = Date.now()
  const now = new Date()

  console.info("[cron/rodar-dashboard-vendedor] Iniciando processamento...")
  console.info(`[cron/rodar-dashboard-vendedor] Data atual: ${now.toISOString()}`)
  console.info(`[cron/rodar-dashboard-vendedor] Meses antecedência ATIVOS: ${MESES_ANTECEDENCIA_ATIVOS}`)
  console.info(`[cron/rodar-dashboard-vendedor] Meses antecedência AGENDADOS: ${MESES_ANTECEDENCIA_AGENDADOS}`)

  const results = {
    ativos: {
      processados: 0,
      atualizados: 0,
    },
    agendados: {
      processados: 0,
      atualizados: 0,
    },
    explorados: {
      processados: 0,
      atualizados: 0,
    },
    clientesSemVendedorResetados: 0,
    errors: [] as string[],
  }

  try {
    const runResult = await prisma.$transaction(async (tx) => {
      // ========================================
      // PROCESSAR ATIVOS
      // ========================================
      // Buscar todos os clientes ATIVOS com vendedor que ainda não estão visíveis no dashboard
      // e que têm ultimaManutencao (que para ATIVOS é a data do último pedido)

      const clientesAtivos = await tx.client.findMany({
        where: {
          categoria: "ATIVO",
          vendedorId: { not: null },
          visivelDashVendedor: false, // Só processar os que ainda não estão visíveis
          ultimaManutencao: { not: null },
        },
        select: {
          id: true,
          vendedorId: true,
          ultimaManutencao: true,
        },
      })

      results.ativos.processados = clientesAtivos.length
      console.info(`[cron/rodar-dashboard-vendedor] Clientes ATIVOS a processar: ${clientesAtivos.length}`)

      // Agrupar por vendedor para batch update
      const ativosParaAtualizar: Map<string, number[]> = new Map()

      for (const cliente of clientesAtivos) {
        if (!cliente.vendedorId) continue

        // "Mostre Todos": todos os ativos com vendedor aparecem no dashboard
        const vendedorId = cliente.vendedorId
        if (!ativosParaAtualizar.has(vendedorId)) {
          ativosParaAtualizar.set(vendedorId, [])
        }
        ativosParaAtualizar.get(vendedorId)!.push(cliente.id)
      }

      // Executar batch updates para ATIVOS
      for (const [vendedorId, clientIds] of ativosParaAtualizar) {
        try {
          const updated = await makeClientsVisibleInDashboardBatch(
            tx,
            clientIds,
            vendedorId,
            "ATIVO" as ClientCategoria,
            `Cron mensal: cliente aparece ${MESES_ANTECEDENCIA_ATIVOS} meses antes do vencimento`
          )
          results.ativos.atualizados += updated
        } catch (error) {
          const errorMessage = `Erro ao atualizar ATIVOS do vendedor ${vendedorId}: ${error}`
          console.error(`[cron/rodar-dashboard-vendedor] ${errorMessage}`)
          results.errors.push(errorMessage)
        }
      }

      // ========================================
      // PROCESSAR AGENDADOS (livres com data)
      // ========================================
      // Buscar todos os clientes AGENDADOS com vendedor que ainda não estão visíveis no dashboard

      const clientesAgendados = await tx.client.findMany({
        where: {
          categoria: "AGENDADO",
          vendedorId: { not: null },
          visivelDashVendedor: false, // Só processar os que ainda não estão visíveis
          ultimaManutencao: { not: null },
        },
        select: {
          id: true,
          vendedorId: true,
          ultimaManutencao: true,
        },
      })

      results.agendados.processados = clientesAgendados.length
      console.info(`[cron/rodar-dashboard-vendedor] Clientes AGENDADOS a processar: ${clientesAgendados.length}`)

      // Agrupar por vendedor para batch update
      const agendadosParaAtualizar: Map<string, number[]> = new Map()

      for (const cliente of clientesAgendados) {
        if (!cliente.vendedorId) continue

        // "Mostre Todos": todos os agendados com vendedor aparecem no dashboard
        const vendedorId = cliente.vendedorId
        if (!agendadosParaAtualizar.has(vendedorId)) {
          agendadosParaAtualizar.set(vendedorId, [])
        }
        agendadosParaAtualizar.get(vendedorId)!.push(cliente.id)
      }

      // Executar batch updates para AGENDADOS
      for (const [vendedorId, clientIds] of agendadosParaAtualizar) {
        try {
          const updated = await makeClientsVisibleInDashboardBatch(
            tx,
            clientIds,
            vendedorId,
            "AGENDADO" as ClientCategoria,
            `Cron mensal: cliente aparece ${MESES_ANTECEDENCIA_AGENDADOS} meses antes do vencimento`
          )
          results.agendados.atualizados += updated
        } catch (error) {
          const errorMessage = `Erro ao atualizar AGENDADOS do vendedor ${vendedorId}: ${error}`
          console.error(`[cron/rodar-dashboard-vendedor] ${errorMessage}`)
          results.errors.push(errorMessage)
        }
      }

      // ========================================
      // PROCESSAR EXPLORADOS (livres sem data)
      // ========================================
      // Clientes EXPLORADOS com vendedor SEMPRE aparecem no dashboard

      const clientesExplorados = await tx.client.findMany({
        where: {
          OR: [
            { categoria: "EXPLORADO" },
            { categoria: null }, // Clientes sem categoria também são considerados explorados
          ],
          vendedorId: { not: null },
          visivelDashVendedor: false, // Só atualizar os que ainda não estão visíveis
        },
        select: {
          id: true,
          vendedorId: true,
        },
      })

      results.explorados.processados = clientesExplorados.length
      console.info(`[cron/rodar-dashboard-vendedor] Clientes EXPLORADOS a processar: ${clientesExplorados.length}`)

      // Agrupar por vendedor para batch update com histórico
      const exploradosParaAtualizar: Map<string, number[]> = new Map()

      for (const cliente of clientesExplorados) {
        if (!cliente.vendedorId) continue
        const vendedorId = cliente.vendedorId
        if (!exploradosParaAtualizar.has(vendedorId)) {
          exploradosParaAtualizar.set(vendedorId, [])
        }
        exploradosParaAtualizar.get(vendedorId)!.push(cliente.id)
      }

      // Executar batch updates para EXPLORADOS
      for (const [vendedorId, clientIds] of exploradosParaAtualizar) {
        try {
          const updated = await makeClientsVisibleInDashboardBatch(
            tx,
            clientIds,
            vendedorId,
            "EXPLORADO" as ClientCategoria,
            `Cron mensal: cliente EXPLORADO com vendedor`
          )
          results.explorados.atualizados += updated
        } catch (error) {
          const errorMessage = `Erro ao atualizar EXPLORADOS do vendedor ${vendedorId}: ${error}`
          console.error(`[cron/rodar-dashboard-vendedor] ${errorMessage}`)
          results.errors.push(errorMessage)
        }
      }

      console.info(`[cron/rodar-dashboard-vendedor] Clientes EXPLORADOS atualizados: ${results.explorados.atualizados}`)

      // ========================================
      // GARANTIR QUE CLIENTES SEM VENDEDOR NÃO FIQUEM VISÍVEIS
      // ========================================
      // Por segurança, remover visibilidade de clientes sem vendedor

      const clientesSemVendedorVisiveis = await tx.client.updateMany({
        where: {
          vendedorId: null,
          visivelDashVendedor: true,
        },
        data: {
          visivelDashVendedor: false,
        },
      })

      results.clientesSemVendedorResetados = clientesSemVendedorVisiveis.count
      return results
    })

    const durationMs = Date.now() - startTime

    console.info(`[cron/rodar-dashboard-vendedor] Concluído em ${durationMs}ms`)
    console.info(`[cron/rodar-dashboard-vendedor] ATIVOS: ${runResult.ativos.processados} processados, ${runResult.ativos.atualizados} atualizados`)
    console.info(`[cron/rodar-dashboard-vendedor] AGENDADOS: ${runResult.agendados.processados} processados, ${runResult.agendados.atualizados} atualizados`)
    console.info(`[cron/rodar-dashboard-vendedor] EXPLORADOS: ${runResult.explorados.atualizados} atualizados`)
    console.info(`[cron/rodar-dashboard-vendedor] Clientes sem vendedor resetados: ${runResult.clientesSemVendedorResetados}`)

    return NextResponse.json({
      success: true,
      message: "Processamento concluído",
      timestamp: now.toISOString(),
      durationMs,
      results: {
        ...runResult,
      },
    })
  } catch (error) {
    console.error("[cron/rodar-dashboard-vendedor] Erro fatal:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao processar dashboard do vendedor",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return runDashboardVendedorCron(request)
}

// GET: por padrão executa (para cron). Use ?status=1 para status.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get("status") === "1") {
    return NextResponse.json({
      status: "ok",
      description: "Rota para atualizar visibilidade de clientes no dashboard do vendedor",
      usage: "POST/GET para executar o processamento",
      config: {
        mesesAntecedenciaAtivos: MESES_ANTECEDENCIA_ATIVOS,
        mesesAntecedenciaAgendados: MESES_ANTECEDENCIA_AGENDADOS,
      },
    })
  }
  return runDashboardVendedorCron(request)
}

