import { NextResponse } from "next/server"
import { PedidoStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"

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
  if (cliente.complemento) partes.push(cliente.complemento)
  const bairroCidadeEstado = [cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(" - ")
  if (bairroCidadeEstado) partes.push(bairroCidadeEstado)
  return partes.join(" | ") || "Endereço não informado"
}

export async function GET() {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: { status: PedidoStatus.ANALISE_CANCELAMENTO_SUPERVISAO },
      include: {
        cliente: {
          select: {
            id: true,
            razaoSocial: true,
            cnpj: true,
            logradouro: true,
            numero: true,
            complemento: true,
            bairro: true,
            cidade: true,
            estado: true,
          },
        },
        orcamento: { select: { id: true } },
        visitasTecnicas: {
          where: { status: "ANALISE_NAO_AUTORIZADO" },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { id: true, motivo_nao_autorizado: true },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const data = pedidos.map((pedido) => {
      const diasEmAberto = Math.max(
        0,
        Math.floor((Date.now() - pedido.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      )

      const visita = pedido.visitasTecnicas?.[0]

      return {
        id: pedido.id,
        clienteId: pedido.clienteId,
        clienteRazaoSocial: pedido.cliente.razaoSocial,
        clienteCnpj: pedido.cliente.cnpj,
        endereco: buildEndereco(pedido.cliente),
        estado: pedido.cliente.estado ?? null,
        cidade: pedido.cliente.cidade ?? null,
        motivoNaoAutorizado: visita?.motivo_nao_autorizado ?? null,
        visitaNaoAutorizadaId: visita?.id ?? null,
        motivoCancelamento: pedido.motivoCancelamento ?? "—",
        orcamentoId: pedido.orcamento?.id ?? null,
        criadoEm: pedido.createdAt,
        diasEmAberto,
        alerta: diasEmAberto > 90,
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error("[supervisao][nao-autorizados][GET]", error)
    const message =
      error instanceof Error ? error.message : "Não foi possível carregar pedidos não autorizados."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


