import {
  DocumentoOperacionalStatus,
  DocumentoOperacionalTipo,
  ListaExtraStatus,
  OrcamentoStatus,
  PedidoStatus,
  PrismaClient,
  VisitaTecnicaStatus,
} from "@prisma/client"

import { generateRelatorioVistoriaPdf } from "@/lib/documents/relatorio-vistoria"
import { generateTermoConclusaoPdf } from "@/lib/documents/termo-conclusao"

type FinalizarVisitaNormalInput = {
  visitaId: number
  checklistConcluido?: boolean
  itensExtras?: Array<{
    itemId: number
    quantidade: number
    valorUnitario?: number
  }>
  medicaoOhmica?: number
  medicaoOhmicaMulti?: Array<{ torre: string; valor: number }>
}

export async function finalizarVisitaNormal(
  prisma: PrismaClient,
  input: FinalizarVisitaNormalInput
) {
  const visita = await prisma.visitaTecnica.findUnique({
    where: { id: input.visitaId },
    select: {
      id: true,
      pedidoId: true,
      orcamentoId: true,
      status: true,
      pedido: {
        select: {
          visitasTecnicas: {
            select: {
              id: true,
              listaExtras: {
                select: { id: true }
              }
            }
          },
          itens: {
            select: { item: { select: { categoria: true } } }
          }
        }
      }
    },
  })

  if (!visita) {
    throw new Error("Visita técnica não encontrada.")
  }

  const passouPeloSac = visita.pedido?.visitasTecnicas.some(v => v.listaExtras.length > 0) ?? false
  const temItensProduto = (visita.pedido?.itens || []).some((it: any) => it.item?.categoria === "Produto")
  const totalVisitas = (visita.pedido?.visitasTecnicas || []).length
  const isFirstVisitWithPieces = totalVisitas <= 1 && temItensProduto
  const isSpecialVisit = passouPeloSac || isFirstVisitWithPieces

  if (!isSpecialVisit && !input.checklistConcluido) {
    throw new Error("Finalize o checklist antes de concluir a visita.")
  }

  if (visita.status === VisitaTecnicaStatus.CANCELADO) {
    throw new Error("Não é possível finalizar uma visita cancelada.")
  }

  const itensExtras = (input.itensExtras ?? []).filter((item) => item.itemId)
  const hasExtras = itensExtras.length > 0
  const medicaoOhmica = input.medicaoOhmica

  const quantidadeInvalida = itensExtras.some((item) => !item.quantidade || item.quantidade <= 0)
  if (quantidadeInvalida) {
    throw new Error("Quantidade de item inválida.")
  }

  let deveGerarRelatorio = false
  let termoParaGerar: { id: number; url: string | null } | null = null

  await prisma.$transaction(async (tx) => {
    if (!hasExtras && visita.pedidoId) {
      if (medicaoOhmica === undefined || Number.isNaN(Number(medicaoOhmica))) {
        throw new Error("Informe a medição ôhmica para concluir o serviço.")
      }

      const documentos = await tx.documentoOperacional.findMany({
        where: {
          pedidoId: visita.pedidoId,
          tipo: { in: [DocumentoOperacionalTipo.RELATORIO_VISTORIA, DocumentoOperacionalTipo.TERMO_CONCLUSAO] },
        },
        select: { id: true, tipo: true, status: true, dadosExtras: true, url: true },
      })

      const temRelatorioOk = documentos.some(
        (d) => d.tipo === DocumentoOperacionalTipo.RELATORIO_VISTORIA && d.status === DocumentoOperacionalStatus.COMPLETO,
      )
      const termoOk = documentos.find(
        (d) => d.tipo === DocumentoOperacionalTipo.TERMO_CONCLUSAO && d.status === DocumentoOperacionalStatus.COMPLETO,
      )
      if (termoOk) {
        termoParaGerar = { id: Number(termoOk.id), url: termoOk.url ?? null }
      }

      const relatorioMandatorio = !isSpecialVisit;

      if ((relatorioMandatorio && !temRelatorioOk) || !termoOk) {
        throw new Error(
          relatorioMandatorio
            ? "Finalize os documentos (relatório de vistoria e termo de conclusão) antes de concluir a visita."
            : "Finalize o termo de conclusão antes de concluir a visita."
        )
      }
    }

    const relatorioDaVisita = await tx.documentoOperacional.findFirst({
      where: {
        pedidoId: visita.pedidoId ?? undefined,
        tipo: DocumentoOperacionalTipo.RELATORIO_VISTORIA,
      },
      select: { dadosExtras: true },
    })
    const extras = relatorioDaVisita?.dadosExtras
    if (
      extras &&
      typeof extras === "object" &&
      !Array.isArray(extras) &&
      Number((extras as Record<string, unknown>).visitaTecnicaId) === input.visitaId
    ) {
      deveGerarRelatorio = Boolean(visita.pedidoId)
    }

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

    if (hasExtras) {
      const listaExtra = await tx.listaExtra.create({
        data: {
          visitaId: input.visitaId,
          status: ListaExtraStatus.PENDENTE,
        },
      })

      if (itensExtras.length) {
        await tx.listaExtraItem.createMany({
          data: itensExtras.map((item) => ({
            listaExtraId: listaExtra.id,
            itemId: BigInt(item.itemId),
            quantidade: item.quantidade,
          })),
        })
      }

      if (visita.pedidoId) {
        await tx.pedido.update({
          where: { id: visita.pedidoId },
          data: { status: PedidoStatus.SAC },
        })
      }
    } else if (visita.pedidoId) {
      await tx.pedido.update({
        where: { id: visita.pedidoId },
        data: {
          status: PedidoStatus.AGUARDANDO_APROVACAO_SUPERVISAO,
          medicaoOhmica,
          medicaoOhmicaMulti: input.medicaoOhmicaMulti ?? null,
        } as any,
      })
    }
  })

  if (deveGerarRelatorio && visita.pedidoId) {
    try {
      await generateRelatorioVistoriaPdf({ pedidoId: visita.pedidoId, visitaId: input.visitaId })
    } catch (err) {
      console.error("[tecnico][visitas][finalizar][pdf-relatorio]", err)
    }
  }

  const termoDoc = termoParaGerar as { id: number; url: string | null } | null
  const termoDocumentoId = termoDoc?.id
  if (termoDocumentoId && !termoDoc?.url) {
    try {
      await generateTermoConclusaoPdf({ documentoId: termoDocumentoId })
    } catch (err) {
      console.error("[tecnico][visitas][finalizar][pdf-termo]", err)
    }
  }
}

