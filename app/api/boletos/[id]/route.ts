import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateItauBoletoPdf, generateSantanderBoletoPdf } from "@/lib/boleto"
import fs from "fs"

type RouteParams = { id?: string }
type RouteContext = { params?: RouteParams | Promise<RouteParams> }

const isPromise = (v: unknown): v is Promise<unknown> =>
  typeof v === "object" && v !== null && "then" in v && typeof (v as any).then === "function"

export async function GET(request: Request, context: RouteContext = {}) {
  const rawParams = context.params
  const params = isPromise(rawParams) ? await rawParams : rawParams
  const idParam = params?.id

  const debitoId = Number(idParam)
  if (!debitoId || Number.isNaN(debitoId)) {
    return NextResponse.json({ error: "debitoId inválido" }, { status: 400 })
  }

  try {
    const debito = await prisma.debito.findUnique({
      where: { id: debitoId },
      include: {
        cliente: {
          select: {
            razaoSocial: true,
            cnpj: true,
            cep: true,
            cidade: true,
            estado: true,
            logradouro: true,
            numero: true,
            bairro: true,
            complemento: true,
          },
        },
        pedido: {
          select: {
            bancoEmissorId: true,
          },
        },
      },
    })

    if (!debito) {
      return NextResponse.json({ error: "Débito não encontrado." }, { status: 404 })
    }
    if (!debito.pedido?.bancoEmissorId) {
      return NextResponse.json({ error: "Banco emissor não associado ao débito." }, { status: 400 })
    }

    // Carrega conta/banco do pedido
    const banco = await prisma.banco.findUnique({ where: { id: debito.pedido.bancoEmissorId } })
    if (!banco) {
      return NextResponse.json({ error: "Conta bancária não encontrada." }, { status: 404 })
    }
    console.log(banco.codigoBeneficiario)
    
    // Bancos suportados: 341 (Itaú), 33 (Santander)
    const bancosSuportados = [341, 33]
    if (!bancosSuportados.includes(banco.bancoCodigo)) {
      return NextResponse.json({ error: "Geração de boleto não implementada para este banco." }, { status: 400 })
    }

    // Monta dados sacado e cedente alinhados à remessa
    const sacado = {
      nome: debito.cliente?.razaoSocial ?? "",
      cnpj: debito.cliente?.cnpj ?? undefined,
      logradouro:
        [debito.cliente?.logradouro, debito.cliente?.numero, debito.cliente?.complemento].filter(Boolean).join(" ") ||
        "",
      bairro: debito.cliente?.bairro ?? "",
      cidade: debito.cliente?.cidade ?? "",
      uf: debito.cliente?.estado ?? "",
      cep: debito.cliente?.cep ?? "",
    }

    const enderecoBanco =
      banco.endereco && typeof banco.endereco === "object" && !Array.isArray(banco.endereco)
        ? (banco.endereco as any)
        : {}
    // Para Itaú legado (campo livre com conta corrente), usamos sempre a conta-corrente como base.
    // Se a conta não estiver preenchida, usamos o código do beneficiário como conta base.
    const contaBase = banco.conta 
    const codigoBeneficiario = banco.codigoBeneficiario

    const cedente = {
      razaoSocial: banco.razaoSocial,
      cnpj: banco.cnpj,
      agencia: banco.agencia || "",
      agenciaDigito: banco.agenciaDigito || "",
      conta: contaBase || "",
      contaDigito: banco.contaDigito || "",
      carteira: banco.carteira,
      codigoBeneficiario,
      // endereço do cedente não é usado no PDF
    }

    const valorTitulo = Number(debito.receber ?? (debito as any).valor ?? 0)
    if (!valorTitulo || Number.isNaN(valorTitulo) || valorTitulo <= 0) {
      return NextResponse.json({ error: "Valor do débito inválido para emissão de boleto." }, { status: 400 })
    }
    if (!debito.vencimento) {
      return NextResponse.json({ error: "Vencimento não informado para emissão de boleto." }, { status: 400 })
    }

    const titulo = {
      nossoNumero: debito.id,
      numeroDocumento: debito.id.toString(),
      valor: valorTitulo,
      vencimento: debito.vencimento,
      emissao: new Date(),
      multaFixa: 15.49,
      jurosMora: Math.floor((valorTitulo * 1.99 * 100) / 100) / 100,
      mensagem1: "ATENÇÃO: NÃO RECONHECEMOS BOLETOS ATUALIZADOS PELA INTERNET.",
      mensagem2: `APOS O VENCIMENTO COBRAR MULTA R$ 15,49 E MORA DE 1,99% AO DIA`,
    }

    let filePath: string
    let nomeArquivoPdf: string

    if (banco.bancoCodigo === 341) {
      // Itaú
      const result = await generateItauBoletoPdf({
        cedente,
        sacado,
        titulo,
        destinoDir: "/tmp",
        nomeArquivo: `boleto-itau-${debito.id}`,
      })
      filePath = result.filePath
      nomeArquivoPdf = `boleto-itau-${debito.id}.pdf`
    } else if (banco.bancoCodigo === 33) {
      // Santander
      const result = await generateSantanderBoletoPdf({
        cedente,
        sacado,
        titulo,
        destinoDir: "/tmp",
        nomeArquivo: `boleto-santander-${debito.id}`,
      })
      filePath = result.filePath
      nomeArquivoPdf = `boleto-santander-${debito.id}.pdf`
    } else {
      return NextResponse.json({ error: "Banco não suportado." }, { status: 400 })
    }

    const pdfBuffer = fs.readFileSync(filePath)
    const headers = new Headers()
    headers.set("Content-Type", "application/pdf")
    headers.set("Content-Disposition", `attachment; filename="${nomeArquivoPdf}"`)

    return new NextResponse(pdfBuffer, { status: 200, headers })
  } catch (error: any) {
    console.error("[boletos][GET]", error)
    const message = error instanceof Error ? error.message : "Erro ao gerar boleto."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

