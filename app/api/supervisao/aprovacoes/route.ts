import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getPedidosAprovacoes } from "@/domain/supervisao/pedidos-aprovacoes-usecase"

const buildEndereco = (cliente: {
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
}) => {
  const partes: string[] = []
  if (cliente.logradouro) {
    const numero = cliente.numero ? `, ${cliente.numero}` : ""
    partes.push(`${cliente.logradouro}${numero}`)
  }
  if (cliente.complemento) {
    partes.push(cliente.complemento)
  }
  const bairroCidadeEstado = [cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(" - ")
  if (bairroCidadeEstado) {
    partes.push(bairroCidadeEstado)
  }
  return partes.join(" | ") || "Endereço não informado"
}

export async function GET() {
  try {
    const result = await getPedidosAprovacoes(prisma)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[supervisao][aprovacoes][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar os pedidos para aprovação."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

