import { NextResponse } from "next/server"
import { DocumentoOperacionalStatus, DocumentoOperacionalTipo, VisitaTecnicaStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const serializeDocumento = (doc: {
  id: number
  tipo: DocumentoOperacionalTipo
  status: DocumentoOperacionalStatus
  url: string | null
  dadosExtras: any | null
  assinaturas: Array<{
    id: number
    nomeCompletoAssinante: string
    cpfAssinante: string | null
    localizacao: string
    url: string | null
  }>
}) => ({
  id: doc.id,
  tipo: doc.tipo,
  status: doc.status,
  url: doc.url,
  dadosExtras: doc.dadosExtras,
  assinaturas: doc.assinaturas.map((assinatura) => ({
    id: assinatura.id,
    nomeCompletoAssinante: assinatura.nomeCompletoAssinante,
    cpfAssinante: assinatura.cpfAssinante,
    localizacao: assinatura.localizacao,
    url: assinatura.url,
  })),
})

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const visitaId = Number.parseInt(id, 10)
    if (Number.isNaN(visitaId)) {
      return NextResponse.json({ error: "ID da visita inválido." }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as { tipo?: DocumentoOperacionalTipo; dadosExtras?: unknown }
    const tipo = body.tipo
    const tiposValidos = Object.values(DocumentoOperacionalTipo)
    if (!tipo || !tiposValidos.includes(tipo)) {
      return NextResponse.json({ error: "Tipo de documento inválido." }, { status: 400 })
    }

    const visita = await prisma.visitaTecnica.findUnique({
      where: { id: visitaId },
      select: { pedidoId: true, status: true },
    })

    if (!visita) {
      return NextResponse.json({ error: "Visita técnica não encontrada." }, { status: 404 })
    }

    if (visita.status !== VisitaTecnicaStatus.EM_EXECUCAO) {
      return NextResponse.json(
        { error: "Documentos só podem ser gerados após iniciar a visita." },
        { status: 400 },
      )
    }

    if (!visita.pedidoId) {
      return NextResponse.json(
        { error: "A visita não está vinculada a um pedido. Não é possível gerar documentos." },
        { status: 400 },
      )
    }

    const existente = await prisma.documentoOperacional.findUnique({
      where: {
        pedidoId_tipo: {
          pedidoId: visita.pedidoId,
          tipo,
        },
      },
      include: { assinaturas: true },
    })

    const asJsonObject = (value: unknown) =>
      value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

    const mountDadosExtras = (base: unknown) => {
      const merged = { ...asJsonObject(base), ...asJsonObject(body.dadosExtras) }
      if (tipo === DocumentoOperacionalTipo.RELATORIO_VISTORIA) {
        merged.visitaTecnicaId = visitaId
      }
      return merged
    }

    if (existente) {
      const updated =
        body.dadosExtras !== undefined
          ? await prisma.documentoOperacional.update({
              where: { id: existente.id },
              data: { dadosExtras: mountDadosExtras(existente.dadosExtras) as any },
              include: { assinaturas: true },
            })
          : existente
      return NextResponse.json({ data: serializeDocumento(updated), alreadyExists: true })
    }

    const documento = await prisma.documentoOperacional.create({
      data: {
        pedidoId: visita.pedidoId,
        tipo,
        status: DocumentoOperacionalStatus.PENDENTE,
        dadosExtras: mountDadosExtras(null) as any,
      },
      include: { assinaturas: true },
    })

    return NextResponse.json({ data: serializeDocumento(documento) })
  } catch (error) {
    console.error("[tecnico][visitas][documentos][POST]", error)
    const message = error instanceof Error ? error.message : "Não foi possível gerar o documento."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


