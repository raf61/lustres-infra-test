import { OrcamentoStatus, type PrismaClient } from "@prisma/client"

export interface CancelOrcamentoRepository {
  getStatus(orcamentoId: number): Promise<{ id: number; status: string | null } | null>
  cancel(orcamentoId: number): Promise<void>
}

export function createCancelOrcamentoRepository(prisma: PrismaClient): CancelOrcamentoRepository {
  return {
    async getStatus(orcamentoId: number) {
      return prisma.orcamento.findUnique({
        where: { id: orcamentoId },
        select: { id: true, status: true },
      })
    },

    async cancel(orcamentoId: number) {
      await prisma.orcamento.update({
        where: { id: orcamentoId },
        data: { status: OrcamentoStatus.CANCELADO },
      })
    },
  }
}
