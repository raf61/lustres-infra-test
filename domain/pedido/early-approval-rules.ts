/**
 * Domain Layer - Regras de negócio para aprovação precoce de pedido
 * 
 * Este módulo contém as regras puras de negócio, sem dependência de infraestrutura.
 * Pode ser testado isoladamente.
 */

// Status de pedido permitidos para aprovação precoce
export const ALLOWED_STATUSES_FOR_EARLY_APPROVAL = ["AGUARDANDO", "AGENDADO_OU_EXECUCAO"] as const

// Status de visita que devem ser cancelados
export const VISIT_STATUSES_TO_CANCEL = ["PENDENTE", "AGENDADA", "EM_ANDAMENTO", "EM_EXECUCAO"] as const

// Roles permitidas para executar aprovação precoce
export const ROLES_ALLOWED_FOR_EARLY_APPROVAL = ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] as const

export type AllowedStatusForEarlyApproval = typeof ALLOWED_STATUSES_FOR_EARLY_APPROVAL[number]
export type VisitStatusToCancel = typeof VISIT_STATUSES_TO_CANCEL[number]
export type RoleAllowedForEarlyApproval = typeof ROLES_ALLOWED_FOR_EARLY_APPROVAL[number]

export interface VisitPreview {
  id: number
  status: string
  dataMarcada: Date | null
  tecnicoNome: string | null
  willBeCancelled: boolean
}

export interface EarlyApprovalPreview {
  pedidoId: number
  currentStatus: string
  targetStatus: string
  visitsToCancel: VisitPreview[]
  canProceed: boolean
  blockingReasons: string[]
}

export interface EarlyApprovalResult {
  success: boolean
  pedidoId: number
  newStatus: string
  visitsCancelled: number
  error?: string
}

/**
 * Verifica se o status do pedido permite aprovação precoce
 */
export function canApplyEarlyApproval(status: string): boolean {
  return ALLOWED_STATUSES_FOR_EARLY_APPROVAL.includes(status as AllowedStatusForEarlyApproval)
}

/**
 * Verifica se a role tem permissão para executar aprovação precoce
 */
export function isRoleAllowedForEarlyApproval(role: string): boolean {
  return ROLES_ALLOWED_FOR_EARLY_APPROVAL.includes(role as RoleAllowedForEarlyApproval)
}

/**
 * Determina se uma visita deve ser cancelada
 */
export function shouldCancelVisit(visitStatus: string): boolean {
  // Normaliza o status para comparação
  const normalizedStatus = visitStatus.toUpperCase().replace(/ /g, "_")
  return VISIT_STATUSES_TO_CANCEL.some(
    (s) => s === normalizedStatus || s.replace(/_/g, " ") === visitStatus.toUpperCase()
  )
}

/**
 * Gera o preview das ações que serão executadas
 */
export function generateEarlyApprovalPreview(
  pedidoId: number,
  currentStatus: string,
  visits: Array<{ id: number; status: string; dataMarcada: Date | null; tecnicoNome: string | null }>
): EarlyApprovalPreview {
  const blockingReasons: string[] = []

  // Verifica se o status permite aprovação precoce
  if (!canApplyEarlyApproval(currentStatus)) {
    blockingReasons.push(`Status atual "${currentStatus}" não permite aprovação precoce`)
  }

  // Mapeia as visitas com informação de cancelamento
  const visitsToCancel: VisitPreview[] = visits.map((visit) => ({
    id: visit.id,
    status: visit.status,
    dataMarcada: visit.dataMarcada,
    tecnicoNome: visit.tecnicoNome,
    willBeCancelled: shouldCancelVisit(visit.status),
  }))

  return {
    pedidoId,
    currentStatus,
    targetStatus: "AGUARDANDO_APROVACAO_FINAL",
    visitsToCancel,
    canProceed: blockingReasons.length === 0,
    blockingReasons,
  }
}

