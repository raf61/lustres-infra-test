import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { extractDigits, formatCnpjDigits } from "@/lib/cnpj"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const cnpjParam = searchParams.get("cnpj")

    if (!cnpjParam) {
      return NextResponse.json({ error: "CNPJ é obrigatório" }, { status: 400 })
    }

    const cnpjDigits = extractDigits(cnpjParam)
    if (cnpjDigits.length !== 14) {
      return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 })
    }

    // Formata o CNPJ para buscar no banco
    const formattedCnpj = formatCnpjDigits(cnpjDigits)

    // Busca em paralelo em Cliente e Ficha
    const [cliente, ficha] = await Promise.all([
      prisma.client.findFirst({
        where: {
          OR: [
            { cnpj: cnpjDigits },
            { cnpj: formattedCnpj ?? undefined },
          ],
        },
        select: { id: true, razaoSocial: true },
      }),
      prisma.ficha.findFirst({
        where: {
          OR: [
            { cnpj: cnpjDigits },
            { cnpj: formattedCnpj ?? undefined },
          ],
        },
        select: { id: true, razaoSocial: true },
      }),
    ])

    const existeEmCliente = cliente !== null
    const existeEmFicha = ficha !== null
    const existe = existeEmCliente || existeEmFicha

    let mensagem = ""
    if (existeEmCliente && existeEmFicha) {
      mensagem = `CNPJ já cadastrado como Cliente (${cliente.razaoSocial || "sem nome"}) e como Ficha (${ficha.razaoSocial || "sem nome"})`
    } else if (existeEmCliente) {
      mensagem = `CNPJ já cadastrado como Cliente: ${cliente.razaoSocial || "sem nome"}`
    } else if (existeEmFicha) {
      mensagem = `CNPJ já cadastrado como Ficha: ${ficha.razaoSocial || "sem nome"}`
    }

    return NextResponse.json({
      existe,
      existeEmCliente,
      existeEmFicha,
      mensagem,
      cliente: existeEmCliente ? { id: cliente.id, razaoSocial: cliente.razaoSocial } : null,
      ficha: existeEmFicha ? { id: ficha.id, razaoSocial: ficha.razaoSocial } : null,
    })
  } catch (error) {
    console.error("[cnpj/verificar][GET]", error)
    return NextResponse.json({ error: "Erro ao verificar CNPJ" }, { status: 500 })
  }
}

