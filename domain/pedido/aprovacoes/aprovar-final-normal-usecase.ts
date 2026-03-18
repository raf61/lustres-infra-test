import {
  DocumentoOperacionalStatus,
  DocumentoOperacionalTipo,
  PedidoStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client"

import { resolveFilialId } from "@/app/api/orcamentos/filial-map"
import { generateLaudoTecnicoPdf } from "@/lib/documents/laudo-tecnico"
import { generateCartaEndossoPdf } from "@/lib/documents/carta-endosso"
import { ensureDebitos } from "@/domain/financeiro/ensure-debitos.usecase"

// Enquanto o client Prisma não é regenerado com o novo enum
const LAUDO_TECNICO = "LAUDO_TECNICO" as DocumentoOperacionalTipo
const CARTA_ENDOSSO = "CARTA_ENDOSSO" as DocumentoOperacionalTipo

type AprovarFinalInput = {
  pedidoId: number
  emitirLaudoTecnico?: boolean
  emitirCartaEndosso?: boolean
  bancoEmissorId?: number
}

export async function aprovarFinalNormal(
  prisma: PrismaClient,
  input: AprovarFinalInput
) {
  const emitirDebitos = true // não opcional, default true
  const emitirLaudoTecnico = input.emitirLaudoTecnico === true
  const emitirCartaEndosso = input.emitirCartaEndosso === true
  const bancoEmissorId = typeof input.bancoEmissorId === "number" ? input.bancoEmissorId : undefined

  if (!bancoEmissorId) {
    throw new Error("Selecione o banco emissor.")
  }

  const bancoExiste = await prisma.banco.findUnique({ where: { id: bancoEmissorId } })
  if (!bancoExiste) {
    throw new Error("Banco emissor não encontrado.")
  }

  const pedido = await prisma.pedido.findUnique({
    where: { id: input.pedidoId },
    include: {
      cliente: { select: { id: true, estado: true } },
      orcamento: { select: { id: true, empresaId: true, parcelas: true, primeiroVencimento: true, filialId: true } },
      itens: { select: { quantidade: true, valorUnitarioPraticado: true } },
    },
  })

  if (!pedido) {
    throw new Error("Pedido não encontrado.")
  }

  if (pedido.status !== PedidoStatus.AGUARDANDO_APROVACAO_FINAL) {
    throw new Error("Pedido não está aguardando aprovação final.")
  }

  const parcelas = pedido.orcamento?.parcelas ?? 1
  const primeiroVencimento = pedido.orcamento?.primeiroVencimento

  if (!primeiroVencimento) {
    throw new Error("Primeiro vencimento não definido no orçamento.")
  }
  if (!parcelas || parcelas <= 0) {
    throw new Error("Número de parcelas inválido no orçamento.")
  }

  // NOTE: Cálculos de valores movidos para ensureDebitos.usecase

  let laudoUrl: string | null = null
  let laudoDocIdToGenerate: number | null = null
  let cartaEndossoUrl: string | null = null
  let cartaDocIdToUpdate: number | null = null
  const isEmpresaEbr = pedido.orcamento?.empresaId === 1

  await prisma.$transaction(async (tx) => {
    if (pedido.orcamento && !pedido.orcamento.filialId) {
      const empresaId = pedido.orcamento.empresaId
      if (!empresaId) {
        throw new Error("Orçamento sem empresa definida; não é possível aprovar.")
      }
      const filialId = await resolveFilialId(tx, empresaId, pedido.cliente.estado ?? null)
      if (!filialId) {
        throw new Error("Não foi possível definir a filial para este pedido.")
      }
      await tx.orcamento.update({
        where: { id: pedido.orcamento.id },
        data: { filialId },
      })
    }

    if (emitirDebitos) {
      // UseCase unificado que garante a criação de débitos apenas se não existirem
      await ensureDebitos(tx, input.pedidoId)
    }

    if (emitirLaudoTecnico) {
      const stored = await tx.documentoOperacional.findUnique({
        where: { pedidoId_tipo: { pedidoId: input.pedidoId, tipo: LAUDO_TECNICO } },
        select: { id: true, url: true },
      })

      const docId =
        stored?.id ??
        (
          await tx.documentoOperacional.create({
            data: {
              pedidoId: input.pedidoId,
              tipo: LAUDO_TECNICO,
              status: DocumentoOperacionalStatus.PENDENTE,
            },
            select: { id: true },
          })
        ).id

      if (stored?.url) {
        laudoUrl = stored.url
      } else {
        laudoDocIdToGenerate = docId
      }
    }

    if (isEmpresaEbr && emitirCartaEndosso) {
      const stored = await tx.documentoOperacional.findUnique({
        where: { pedidoId_tipo: { pedidoId: input.pedidoId, tipo: CARTA_ENDOSSO } },
        select: { id: true, url: true },
      })

      if (stored?.url) {
        cartaEndossoUrl = stored.url
        cartaDocIdToUpdate = stored.id
      } else {
        cartaDocIdToUpdate = stored?.id ?? null
      }
    }

    await tx.pedido.update({
      where: { id: input.pedidoId },
      data: { status: PedidoStatus.CONCLUIDO, bancoEmissorId },
    })
  })

  if (emitirLaudoTecnico && laudoDocIdToGenerate && !laudoUrl) {
    laudoUrl = await generateLaudoTecnicoPdf({ pedidoId: input.pedidoId })
    if (!laudoUrl) {
      throw new Error("Falha ao gerar o Laudo Técnico.")
    }

    await prisma.documentoOperacional.update({
      where: { id: laudoDocIdToGenerate },
      data: { url: laudoUrl, status: DocumentoOperacionalStatus.COMPLETO },
    })
  }

  if (isEmpresaEbr && emitirCartaEndosso && !cartaEndossoUrl) {
    cartaEndossoUrl = await generateCartaEndossoPdf({ pedidoId: input.pedidoId })
    if (!cartaEndossoUrl) {
      throw new Error("Falha ao gerar a Carta de Endosso.")
    }

    if (cartaDocIdToUpdate) {
      await prisma.documentoOperacional.update({
        where: { id: cartaDocIdToUpdate },
        data: { url: cartaEndossoUrl, status: DocumentoOperacionalStatus.COMPLETO },
      })
    } else {
      await prisma.documentoOperacional.create({
        data: {
          pedidoId: input.pedidoId,
          tipo: CARTA_ENDOSSO,
          status: DocumentoOperacionalStatus.COMPLETO,
          url: cartaEndossoUrl,
        },
      })
    }
  }
}

