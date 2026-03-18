import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { generateItauRemessa } from "@/lib/cnab/itau_v2"
import { generateSantanderRemessa } from "@/lib/cnab/santander_v2"
import { storage } from "@/lib/storage"

type RemessaPayload = {
  bancoId?: number
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RemessaPayload
    const bancoId = body.bancoId

    if (!bancoId || Number.isNaN(bancoId)) {
      return NextResponse.json({ error: "bancoId é obrigatório." }, { status: 400 })
    }
    const banco = await prisma.banco.findUnique({ where: { id: bancoId } })
    if (!banco) {
      return NextResponse.json({ error: "Banco não encontrado." }, { status: 404 })
    }

    const hoje = new Date()

    const debitos = await prisma.debito.findMany({
      where: {
        stats: 0,
        remessa: false,
        vencimento: { gt: hoje },
        pedido: { bancoEmissorId: bancoId },
      },
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
      },
      orderBy: { id: "asc" },
    })

    if (!debitos.length) {
      throw new Prisma.PrismaClientKnownRequestError("SEM_DEBITOS", {
        code: "P2000",
        clientVersion: "0",
      } as any)
    }

    // Sequencial simples baseado em data/hora (YYMMDDHHII formato reduzido)
    // Idealmente deveria vir de um contador no banco de dados
    const agora = new Date()
    const sequencial = Number(
      agora.getFullYear().toString().slice(-2) +
      (agora.getMonth() + 1).toString().padStart(2, '0') +
      agora.getDate().toString().padStart(2, '0')
    ) // Ex: 231223 para 23/12/2023

    const mapper = debitos.map((d) => ({
      id: d.id,
      receber: d.receber,
      vencimento: d.vencimento,
    cliente: {
      razaoSocial: d.cliente?.razaoSocial,
      cnpj: d.cliente?.cnpj,
      cep: d.cliente?.cep,
      cidade: d.cliente?.cidade,
      estado: d.cliente?.estado,
      logradouro: d.cliente?.logradouro,
      numero: d.cliente?.numero,
      bairro: d.cliente?.bairro,
      complemento: d.cliente?.complemento,
    },
    }))

    let file
    if (banco.bancoCodigo === 341) {
      file = generateItauRemessa({ cedente: banco, debitos: mapper, sequencialArquivo: sequencial })
    } else if (banco.bancoCodigo === 33) {
      file = generateSantanderRemessa({ cedente: banco, debitos: mapper, sequencialArquivo: sequencial })
    } else {
      return NextResponse.json({ error: "Banco não suportado para remessa." }, { status: 400 })
    }

    const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "")
    const convenioPart = (banco.codigoBeneficiario || banco.codigoTransmissao || banco.id.toString()).replace(/[^0-9]/g, "")
    const finalName = `${banco.bancoCodigo}${convenioPart}${timestamp}.txt`

    await prisma.debito.updateMany({
      where: { id: { in: debitos.map((d) => d.id) }, remessa: false },
      data: { remessa: true },
    })

    const safeName = finalName.replace(/[^a-zA-Z0-9_.-]/g, "_")
    const key = `remessas/${safeName}`
    await storage.uploadPrivateObject({ key, contentType: file.mimeType, body: file.content })

    const headers = new Headers()
    headers.set("Content-Type", file.mimeType)
    headers.set("Content-Disposition", `attachment; filename="${file.filename}"`)

    return new NextResponse(file.content, {
      status: 200,
      headers,
    })
  } catch (error: any) {
    if (error?.message === "SEM_DEBITOS") {
      return NextResponse.json({ error: "Nenhum débito elegível para remessa." }, { status: 400 })
    }
    console.error("[remessas][POST]", error)
    const message = error instanceof Error ? error.message : "Erro ao gerar remessa."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

