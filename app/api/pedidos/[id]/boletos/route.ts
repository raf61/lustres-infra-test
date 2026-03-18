import { NextResponse } from "next/server"
import fs from "fs"
import PDFMerger from "pdf-merger-js"

import { prisma } from "@/lib/prisma"
import { generateItauBoletoPdf, generateSantanderBoletoPdf } from "@/lib/boleto"
import { generateMergedBoletosPdf } from "@/domain/pedido/boletos/generate-merged-boletos-usecase"
import type { DebitoParaBoleto } from "@/domain/pedido/boletos/merged-boletos-repository"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

const bancosSuportados = new Set([341, 33])

const buildSacado = (debito: DebitoParaBoleto) => ({
  nome: debito.cliente?.razaoSocial ?? "",
  cnpj: debito.cliente?.cnpj ?? undefined,
  logradouro:
    [debito.cliente?.logradouro, debito.cliente?.numero, debito.cliente?.complemento].filter(Boolean).join(" ") || "",
  bairro: debito.cliente?.bairro ?? "",
  cidade: debito.cliente?.cidade ?? "",
  uf: debito.cliente?.estado ?? "",
  cep: debito.cliente?.cep ?? "",
})

const buildCedente = (debito: DebitoParaBoleto) => {
  if (!debito.banco) {
    throw new Error("Conta bancária não encontrada.")
  }

  const contaBase = debito.banco.conta
  return {
    razaoSocial: debito.banco.razaoSocial,
    cnpj: debito.banco.cnpj,
    agencia: debito.banco.agencia || "",
    agenciaDigito: debito.banco.agenciaDigito || "",
    conta: contaBase || "",
    contaDigito: debito.banco.contaDigito || "",
    carteira: debito.banco.carteira,
    codigoBeneficiario: debito.banco.codigoBeneficiario,
  }
}

const buildTitulo = (debito: DebitoParaBoleto) => {
  const valorTitulo = Number(debito.receber ?? 0)
  if (!valorTitulo || Number.isNaN(valorTitulo) || valorTitulo <= 0) {
    throw new Error("Valor do débito inválido para emissão de boleto.")
  }
  if (!debito.vencimento) {
    throw new Error("Vencimento não informado para emissão de boleto.")
  }

  return {
    nossoNumero: debito.id,
    numeroDocumento: debito.id.toString(),
    valor: valorTitulo,
    vencimento: debito.vencimento,
    emissao: new Date(),
    multaFixa: 15.49,
    jurosMora: Math.floor((valorTitulo * 1.99 * 100) / 100) / 100,
    mensagem1: "ATENÇÃO: NÃO RECONHECEMOS BOLETOS ATUALIZADOS PELA INTERNET.",
    mensagem2: "APOS O VENCIMENTO COBRAR MULTA R$ 15,49 E MORA DE 1,99% AO DIA",
  }
}

const generateBoletoPdf = async (debito: DebitoParaBoleto): Promise<Buffer> => {
  if (!debito.banco || !bancosSuportados.has(debito.banco.bancoCodigo)) {
    throw new Error("Banco não suportado para geração de boleto.")
  }

  const sacado = buildSacado(debito)
  const cedente = buildCedente(debito)
  const titulo = buildTitulo(debito)

  let filePath: string
  if (debito.banco.bancoCodigo === 341) {
    const result = await generateItauBoletoPdf({
      cedente,
      sacado,
      titulo,
      destinoDir: "/tmp",
      nomeArquivo: `boleto-itau-${debito.id}`,
    })
    filePath = result.filePath
  } else {
    const result = await generateSantanderBoletoPdf({
      cedente,
      sacado,
      titulo,
      destinoDir: "/tmp",
      nomeArquivo: `boleto-santander-${debito.id}`,
    })
    filePath = result.filePath
  }

  return fs.readFileSync(filePath)
}

const mergePdfBuffers = async (buffers: Buffer[]) => {
  const merger = new PDFMerger()
  for (const buffer of buffers) {
    await merger.add(buffer)
  }
  return merger.saveAsBuffer()
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const pedidoId = Number.parseInt(id, 10)
    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 })
    }

    const result = await generateMergedBoletosPdf(
      prisma,
      { pedidoId },
      { generateBoletoPdf, mergePdfBuffers }
    )

    const headers = new Headers()
    headers.set("Content-Type", "application/pdf")
    headers.set("Content-Disposition", `attachment; filename="boletos-pedido-${pedidoId}.pdf"`)

    return new NextResponse(result.buffer, { status: 200, headers })
  } catch (error) {
    console.error("[pedidos][boletos][GET]", error)
    const message = error instanceof Error ? error.message : "Erro ao gerar boletos."
    const status = message.includes("inválid") || message.includes("Nenhum débito") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
