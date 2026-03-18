import { Prisma, PrismaClient } from "@prisma/client"
import { prisma as defaultPrisma } from "@/lib/prisma"
import {
  type ClientCategoryInput,
  type ClientCategoria,
  buildAtivoConditionSql,
  buildAgendadoConditionSql,
} from "@/domain/client/category-rules"

type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient

/**
 * Calcula a categoria de um cliente baseado nas regras atualizadas:
 *
 * ATIVO: 
 *   - Tem pedido NÃO CANCELADO nos últimos 13 meses
 *   - A data do último pedido é >= ultimaManutencao do cliente
 *
 * AGENDADO (Livres com Data): 
 *   - Não é ativo
 *   - Tem ultimaManutencao nos últimos 13 meses (manutenção com concorrente)
 *
 * EXPLORADO (Livres sem Data):
 *   - Nem ativo nem agendado
 * 
 * @param clientId - ID do cliente
 * @param prismaClient - Cliente Prisma opcional (para uso em transações)
 */
export async function calculateClientCategory(
  clientId: number,
  prismaClient: PrismaClientOrTransaction = defaultPrisma
): Promise<ClientCategoria> {
  // IMPORTANT:
  // Para evitar divergências (JS vs SQL) e problemas com timestamps,
  // o cálculo é feito diretamente no banco usando as condições SQL centralizadas.
  // Isso garante comportamento idêntico ao script `recalculate-client-categories.js`.
  const rows = await prismaClient.$queryRaw<Array<{ categoria: ClientCategoria }>>(
    Prisma.sql`
      SELECT
        CASE
          WHEN (${buildAtivoConditionSql()}) THEN 'ATIVO'::"ClientCategoria"
          WHEN (${buildAgendadoConditionSql()}) THEN 'AGENDADO'::"ClientCategoria"
          ELSE 'EXPLORADO'::"ClientCategoria"
        END AS categoria
      FROM "Client" c
      WHERE c."id" = ${clientId}
      LIMIT 1
    `
  )

  return rows?.[0]?.categoria ?? "EXPLORADO"
}

/**
 * Atualiza a categoria de um cliente.
 * 
 * @param clientId - ID do cliente
 * @param prismaClient - Cliente Prisma opcional (para uso em transações)
 */
export async function updateClientCategory(
  clientId: number,
  prismaClient: PrismaClientOrTransaction = defaultPrisma
): Promise<void> {
  // Se não veio TransactionClient (caso padrão), garantimos atomicidade aqui também.
  if (prismaClient === defaultPrisma) {
    await defaultPrisma.$transaction(async (tx) => {
      const categoria = await calculateClientCategory(clientId, tx)
      await tx.client.update({
        where: { id: clientId },
        data: { categoria: categoria as any },
      })
    })
    return
  }

  // Se já veio dentro de uma transação, apenas executa no mesmo tx.
  const categoria = await calculateClientCategory(clientId, prismaClient)
  await prismaClient.client.update({
    where: { id: clientId },
    data: { categoria: categoria as any },
  })
}
