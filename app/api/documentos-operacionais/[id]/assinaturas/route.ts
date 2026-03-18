import { NextResponse } from "next/server"
import { DocumentoOperacionalStatus, DocumentoOperacionalTipo } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { uploadDocOperacionalAssinatura } from "@/lib/signatures"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type AssinaturaPayload = {
  nomeCompletoAssinante?: string
  cpfAssinante?: string | null
  localizacao?: string
  assinaturaDataUrl?: string
  role?: "funcionario_condominio" | "funcionario_tecnico"
}

const requiredSignatures = (tipo: DocumentoOperacionalTipo) =>
  tipo === DocumentoOperacionalTipo.TERMO_CONCLUSAO ||
  tipo === DocumentoOperacionalTipo.RELATORIO_VISTORIA ||
  tipo === DocumentoOperacionalTipo.ORDEM_SERVICO
    ? 2
    : 1

const isValidCpf = (cpfRaw?: string | null) => {
  if (!cpfRaw) return false
  const cpf = cpfRaw.replace(/\D/g, "")
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const calcCheck = (slice: number) => {
    const nums = cpf.slice(0, slice).split("").map(Number)
    const factorStart = slice + 1
    const sum = nums.reduce((acc, num, idx) => acc + num * (factorStart - idx), 0)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  const d1 = calcCheck(9)
  const d2 = calcCheck(10)
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10])
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const documentoId = Number.parseInt(id, 10)
    if (Number.isNaN(documentoId)) {
      return NextResponse.json({ error: "ID do documento inválido." }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as AssinaturaPayload
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "desconhecido"

    if (!body.nomeCompletoAssinante || !body.assinaturaDataUrl) {
      return NextResponse.json(
        { error: "Nome completo e assinatura são obrigatórios." },
        { status: 400 },
      )
    }

    if (!body.localizacao) {
      return NextResponse.json({ error: "Localização é obrigatória." }, { status: 400 })
    }

    if (body.cpfAssinante && !isValidCpf(body.cpfAssinante)) {
      return NextResponse.json({ error: "CPF inválido." }, { status: 400 })
    }

    const documento = await prisma.documentoOperacional.findUnique({
      where: { id: documentoId },
      include: { assinaturas: true },
    })

    if (!documento) {
      return NextResponse.json({ error: "Documento operacional não encontrado." }, { status: 404 })
    }

    if (documento.status === DocumentoOperacionalStatus.COMPLETO) {
      return NextResponse.json({ error: "Este documento já está concluído." }, { status: 400 })
    }

    const limiteAssinaturas = requiredSignatures(documento.tipo)
    if (documento.assinaturas.length >= limiteAssinaturas) {
      return NextResponse.json(
        { error: "O documento já possui assinaturas suficientes." },
        { status: 400 },
      )
    }

    if (
      documento.tipo === DocumentoOperacionalTipo.TERMO_CONCLUSAO ||
      documento.tipo === DocumentoOperacionalTipo.RELATORIO_VISTORIA ||
      documento.tipo === DocumentoOperacionalTipo.ORDEM_SERVICO
    ) {
      if (!body.role || (body.role !== "funcionario_condominio" && body.role !== "funcionario_tecnico")) {
        return NextResponse.json(
          { error: "Role da assinatura é obrigatória para este documento." },
          { status: 400 },
        )
      }
      const hasSameRole = documento.assinaturas.some((ass) => (ass as any)?.dadosExtras?.role === body.role)
      if (hasSameRole) {
        return NextResponse.json({ error: "Esta role já foi assinada." }, { status: 400 })
      }
    }

    // Upload da assinatura para S3 (private)
    const roleForUpload = body.role ?? "assinante"
    const { url: signatureUrl } = await uploadDocOperacionalAssinatura({
      documentoOperacionalId: documento.id,
      role: roleForUpload,
      dataUrl: body.assinaturaDataUrl!,
    })

    const novaAssinatura = await prisma.documentoOperacionalAssinatura.create({
      data: {
        documentoOperacionalId: documento.id,
        nomeCompletoAssinante: body.nomeCompletoAssinante!,
        cpfAssinante: body.cpfAssinante || null,
        ip,
        localizacao: body.localizacao!,
        url: signatureUrl,
        ...(
          (
            documento.tipo === DocumentoOperacionalTipo.TERMO_CONCLUSAO ||
            documento.tipo === DocumentoOperacionalTipo.RELATORIO_VISTORIA ||
            documento.tipo === DocumentoOperacionalTipo.ORDEM_SERVICO
          ) &&
          body.role
          ? { dadosExtras: { role: body.role } }
          : {}),
      },
    })

    const totalAssinaturas = documento.assinaturas.length + 1
    const statusFinal =
      totalAssinaturas >= limiteAssinaturas ? DocumentoOperacionalStatus.COMPLETO : DocumentoOperacionalStatus.PENDENTE

    if (statusFinal !== documento.status) {
      await prisma.documentoOperacional.update({
        where: { id: documento.id },
        data: { status: statusFinal },
      })
    }

    return NextResponse.json({
      data: {
        status: statusFinal,
        assinatura: {
          id: novaAssinatura.id,
          nomeCompletoAssinante: novaAssinatura.nomeCompletoAssinante,
          cpfAssinante: novaAssinatura.cpfAssinante,
          url: novaAssinatura.url,
          localizacao: novaAssinatura.localizacao,
          dadosExtras: (novaAssinatura as any).dadosExtras,
        },
      },
    })
  } catch (error) {
    console.error("[documentos-operacionais][assinaturas][POST]", error)
    const message = error instanceof Error ? error.message : "Não foi possível registrar a assinatura."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


