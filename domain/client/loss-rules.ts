/**
 * Regras para o fluxo de "Perda" de cliente.
 * 
 * Este módulo centraliza a lógica do botão "Perda" no dashboard do vendedor.
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import { makeClientNotVisibleInDashboard } from "./vendor-dashboard-rules"
import { releaseClientFromVendor } from "./vendor-assignment-rules"
import { updateClientCategory } from "@/lib/calculate-client-category"
// @ts-ignore - Bypass Clean Arch (conhecimento de chat no domínio de cliente)
import { resolveAllClientConversations } from "@/chat/application/resolve-all-client-conversations"

// ============================================================================
// TIPOS
// ============================================================================

export type LossActionType = "WITH_DATE" | "WITHOUT_DATE"

export interface LossInput {
  clientId: number
  actionType: LossActionType
  ultimaManutencao?: Date | null // Apenas quando actionType === "WITH_DATE"
}

export interface LossResult {
  success: boolean
  message: string
  actionType: LossActionType
  removedFromVendor: boolean
}

// ============================================================================
// CONFIGURAÇÃO - Comportamentos e mensagens
// ============================================================================

export const RECALCULAR_CATEGORIA_APOS_PERDA = true

export const LOSS_REASONS = {
  WITH_DATE: "Perda - cliente informou data de manutenção com concorrente",
  WITHOUT_DATE: "Perda - cliente removido do vendedor (sem data informada)",
}

export const LOSS_MESSAGES = {
  WITH_DATE: "Cliente marcado como perda. Aparecerá novamente 2 meses antes do vencimento da manutenção.",
  WITHOUT_DATE: "Cliente removido do seu dashboard. Ele não aparecerá mais para você.",
}

// ============================================================================
// USE CASE PRINCIPAL
// ============================================================================

/**
 * Processa a ação de "Perda" de um cliente.
 */
export async function processarPerda(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: LossInput
): Promise<LossResult> {
  const run = async (tx: Prisma.TransactionClient | PrismaClient) => {
    const { clientId, actionType, ultimaManutencao } = input

    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { id: true, vendedorId: true },
    })

    if (!client) {
      return {
        success: false,
        message: "Cliente não encontrado",
        actionType,
        removedFromVendor: false,
      }
    }

    if (actionType === "WITH_DATE") {
      if (ultimaManutencao) {
        await tx.client.update({
          where: { id: clientId },
          data: { ultimaManutencao },
        })
      }

      // REMOVIDO DA TRANSACAO: resolveAllClientConversations(clientId)
      // Agora é executado após o commit para não travar o banco.

      if (RECALCULAR_CATEGORIA_APOS_PERDA) {
        await updateClientCategory(clientId, tx)
      }

      await makeClientNotVisibleInDashboard(tx, clientId, LOSS_REASONS.WITH_DATE)

      return {
        success: true,
        message: LOSS_MESSAGES.WITH_DATE,
        actionType,
        removedFromVendor: false,
      }
    } else {
      await releaseClientFromVendor(tx, clientId, LOSS_REASONS.WITHOUT_DATE)

      // REMOVIDO DA TRANSACAO: resolveAllClientConversations(clientId)

      return {
        success: true,
        message: LOSS_MESSAGES.WITHOUT_DATE,
        actionType,
        removedFromVendor: true,
      }
    }
  }

  const maybePrismaClient = prisma as PrismaClient
  if (typeof maybePrismaClient.$transaction === "function") {
    const result = await maybePrismaClient.$transaction(async (tx) => run(tx), {
      timeout: 8000,
    })

    // Executa a resolução de conversas APÓS o commit bem sucedido
    // Isso evita travar a transação de banco com queries de chat
    if (result.success) {
      resolveAllClientConversations(input.clientId).catch(err =>
        console.error(`[LossRules] Erro ao resolver conversas em background:`, err)
      )
    }

    return result
  }

  const result = await run(prisma)
  if (result.success) {
    resolveAllClientConversations(input.clientId).catch(err =>
      console.error(`[LossRules] Erro ao resolver conversas em background:`, err)
    )
  }
  return result
}

/**
 * Valida se a data de última manutenção é válida.
 */
export function validarDataUltimaManutencao(date: Date): { valid: boolean; message?: string } {
  const now = new Date()
  now.setHours(23, 59, 59, 999)

  if (date > now) {
    return {
      valid: false,
      message: "A data de última manutenção não pode ser no futuro",
    }
  }

  return { valid: true }
}
