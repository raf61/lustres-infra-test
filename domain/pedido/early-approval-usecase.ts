/**
 * Use Case - Aprovação Precoce de Pedido
 * 
 * Este é o caso de uso que orquestra a lógica de negócio.
 * Recebe um repositório como dependência (inversão de dependência).
 */

import {
  canApplyEarlyApproval,
  shouldCancelVisit,
  type EarlyApprovalResult,
  type EarlyApprovalPreview,
} from "./early-approval-rules"

// Interface do repositório (porta)
export interface EarlyApprovalRepository {
  getPedidoWithVisits(pedidoId: number): Promise<{
    id: number
    status: string
    visits: Array<{
      id: number
      status: string
      dataMarcada: Date | null
      tecnicoNome: string | null
    }>
  } | null>

  /**
   * Executa múltiplas operações em uma transação atômica
   */
  executeInTransaction(
    pedidoId: number,
    newStatus: string,
    visitIdsToCacel: number[]
  ): Promise<void>
}

// Input do use case
export interface ExecuteEarlyApprovalInput {
  pedidoId: number
}

// Input do preview
export interface GetEarlyApprovalPreviewInput {
  pedidoId: number
}

/**
 * Use Case: Obter preview da aprovação precoce
 */
export async function getEarlyApprovalPreview(
  repository: EarlyApprovalRepository,
  input: GetEarlyApprovalPreviewInput
): Promise<EarlyApprovalPreview> {
  const pedido = await repository.getPedidoWithVisits(input.pedidoId)

  if (!pedido) {
    return {
      pedidoId: input.pedidoId,
      currentStatus: "DESCONHECIDO",
      targetStatus: "AGUARDANDO_APROVACAO_FINAL",
      visitsToCancel: [],
      canProceed: false,
      blockingReasons: ["Pedido não encontrado"],
    }
  }

  const blockingReasons: string[] = []

  if (!canApplyEarlyApproval(pedido.status)) {
    blockingReasons.push(`Status atual "${pedido.status}" não permite aprovação precoce`)
  }

  const visitsToCancel = pedido.visits.map((visit) => ({
    id: visit.id,
    status: visit.status,
    dataMarcada: visit.dataMarcada,
    tecnicoNome: visit.tecnicoNome,
    willBeCancelled: shouldCancelVisit(visit.status),
  }))

  return {
    pedidoId: pedido.id,
    currentStatus: pedido.status,
    targetStatus: "AGUARDANDO_APROVACAO_FINAL",
    visitsToCancel,
    canProceed: blockingReasons.length === 0,
    blockingReasons,
  }
}

/**
 * Use Case: Executar aprovação precoce
 */
export async function executeEarlyApproval(
  repository: EarlyApprovalRepository,
  input: ExecuteEarlyApprovalInput
): Promise<EarlyApprovalResult> {
  const pedido = await repository.getPedidoWithVisits(input.pedidoId)

  if (!pedido) {
    return {
      success: false,
      pedidoId: input.pedidoId,
      newStatus: "",
      visitsCancelled: 0,
      error: "Pedido não encontrado",
    }
  }

  // Valida regras de negócio
  if (!canApplyEarlyApproval(pedido.status)) {
    return {
      success: false,
      pedidoId: input.pedidoId,
      newStatus: pedido.status,
      visitsCancelled: 0,
      error: `Status atual "${pedido.status}" não permite aprovação precoce. Apenas AGUARDANDO ou AGENDADO_OU_EXECUCAO.`,
    }
  }

  // Identifica visitas que devem ser canceladas
  const visitsToCancel = pedido.visits.filter((v) => shouldCancelVisit(v.status))
  const visitIdsToCancel = visitsToCancel.map((v) => v.id)

  // Executa tudo em uma transação atômica
  const newStatus = "AGUARDANDO_APROVACAO_FINAL"
  await repository.executeInTransaction(input.pedidoId, newStatus, visitIdsToCancel)

  return {
    success: true,
    pedidoId: input.pedidoId,
    newStatus,
    visitsCancelled: visitsToCancel.length,
  }
}

