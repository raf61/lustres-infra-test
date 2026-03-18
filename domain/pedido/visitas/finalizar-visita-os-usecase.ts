import {
  DocumentoOperacionalStatus,
  DocumentoOperacionalTipo,
  OrcamentoStatus,
  PedidoStatus,
  PrismaClient,
  VisitaTecnicaStatus,
} from "@prisma/client"

import { generateOrdemServicoPdf } from "@/lib/documents/ordem-servico"

type FinalizarVisitaOsInput = {
  visitaId: number
  medicaoOhmica?: number
  medicaoOhmicaMulti?: Array<{ torre: string; valor: number }>
}

export async function finalizarVisitaOs(
  prisma: PrismaClient,
  input: FinalizarVisitaOsInput
) {
  const visita = await prisma.visitaTecnica.findUnique({
    where: { id: input.visitaId },
    select: { id: true, pedidoId: true, orcamentoId: true, status: true },
  })

  if (!visita) {
    throw new Error("Visita técnica não encontrada.")
  }

  if (visita.status === VisitaTecnicaStatus.CANCELADO) {
    throw new Error("Não é possível finalizar uma visita cancelada.")
  }

  if (!visita.pedidoId) {
    throw new Error("A visita não está vinculada a um pedido.")
  }

  const documentoOs = await prisma.documentoOperacional.findUnique({
    where: {
      pedidoId_tipo: {
        pedidoId: visita.pedidoId,
        tipo: DocumentoOperacionalTipo.ORDEM_SERVICO,
      },
    },
    select: { id: true, status: true, url: true },
  })

  if (!documentoOs || documentoOs.status !== DocumentoOperacionalStatus.COMPLETO) {
    throw new Error("Finalize o documento de Ordem de Serviço antes de concluir a visita.")
  }

  await prisma.$transaction(async (tx) => {
    await tx.visitaTecnica.update({
      where: { id: input.visitaId },
      data: {
        status: VisitaTecnicaStatus.FINALIZADO,
        dataRegistroFim: new Date(),
      },
    })

    if (visita.orcamentoId) {
      await tx.orcamento.update({
        where: { id: visita.orcamentoId },
        data: { status: OrcamentoStatus.APROVADO },
      })
    }

    await tx.pedido.update({
      where: { id: visita.pedidoId as number },
      data: {
        status: PedidoStatus.AGUARDANDO_APROVACAO_SUPERVISAO,
        medicaoOhmica: input.medicaoOhmica ?? null,
        medicaoOhmicaMulti: input.medicaoOhmicaMulti ?? null,
      } as any,
    })
  })

  if (!documentoOs.url) {
    try {
      await generateOrdemServicoPdf({ documentoId: documentoOs.id })
    } catch (err) {
      console.error("[tecnico][visitas][finalizar][pdf-os]", err)
    }
  }
}

