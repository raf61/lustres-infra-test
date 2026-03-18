/**
 * Repository Implementation - Aprovação Precoce
 * 
 * Implementação concreta do repositório usando Prisma.
 * Este é o adapter que conecta o use case à infraestrutura.
 */

import { PrismaClient, VisitaTecnicaStatus, PedidoStatus } from "@prisma/client"
import type { EarlyApprovalRepository } from "./early-approval-usecase"

/**
 * Cria uma instância do repositório de aprovação precoce
 */
export function createEarlyApprovalRepository(prisma: PrismaClient): EarlyApprovalRepository {
  return {
    async getPedidoWithVisits(pedidoId: number) {
      const pedido = await prisma.pedido.findUnique({
        where: { id: pedidoId },
        select: {
          id: true,
          status: true,
          visitasTecnicas: {
            select: {
              id: true,
              status: true,
              dataMarcada: true,
              tecnico: {
                select: { name: true },
              },
            },
          },
        },
      })

      if (!pedido) {
        return null
      }

      return {
        id: pedido.id,
        status: pedido.status,
        visits: pedido.visitasTecnicas.map((v) => ({
          id: v.id,
          status: v.status,
          dataMarcada: v.dataMarcada,
          tecnicoNome: v.tecnico?.name ?? null,
        })),
      }
    },

    async executeInTransaction(pedidoId: number, newStatus: string, visitIdsToCancel: number[]) {
      await prisma.$transaction(async (tx) => {
        // Cancela todas as visitas
        if (visitIdsToCancel.length > 0) {
          await tx.visitaTecnica.updateMany({
            where: { id: { in: visitIdsToCancel } },
            data: { status: VisitaTecnicaStatus.CANCELADO },
          })
        }

        // Atualiza status do pedido
        await tx.pedido.update({
          where: { id: pedidoId },
          data: { status: newStatus as PedidoStatus },
        })
      })
    },
  }
}

