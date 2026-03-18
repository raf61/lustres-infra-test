import { NextResponse } from "next/server"
import { PedidoStatus } from "@prisma/client"
import { differenceInBusinessDays, subMonths } from "date-fns"

import { prisma } from "@/lib/prisma"

type PartialCliente = {
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
}

const buildEndereco = (cliente: PartialCliente) => {
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
    const threeMonthsAgo = subMonths(new Date(), 3)
    const pedidos = await prisma.pedido.findMany({
      where: {
        status: PedidoStatus.AGUARDANDO,
        createdAt: { lt: threeMonthsAgo },
      },
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
        itens: {
          select: {
            quantidade: true,
            valorUnitarioPraticado: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const clienteIds = Array.from(new Set(pedidos.map((pedido) => pedido.cliente.id)))

    const lastConcludedByClient = clienteIds.length
      ? await prisma.pedido.groupBy({
          by: ["clienteId"],
          where: {
            status: PedidoStatus.CONCLUIDO,
            clienteId: { in: clienteIds },
          },
          _max: { createdAt: true },
        })
      : []

    const lastConcludedMap = new Map(lastConcludedByClient.map((row) => [row.clienteId, row._max.createdAt]))

    const data = pedidos.map((pedido) => {
      const valorTotal = pedido.itens.reduce(
        (acc, item) => acc + item.quantidade * item.valorUnitarioPraticado,
        0,
      )
      const diasEmAberto = differenceInBusinessDays(new Date(), pedido.createdAt)
      const lastConcluded = lastConcludedMap.get(pedido.cliente.id) ?? null

      return {
        id: pedido.id,
        clienteId: pedido.cliente.id,
        clienteRazaoSocial: pedido.cliente.razaoSocial,
        clienteCnpj: pedido.cliente.cnpj,
        endereco: buildEndereco(pedido.cliente),
        valorTotal,
        criadoEm: pedido.createdAt,
        orcamentoId: pedido.orcamentoId,
        diasEmAberto,
        ultimaManutencaoConcluida: lastConcluded,
      }
    })

    return NextResponse.json({
      data,
      total: data.length,
    })
  } catch (error) {
    console.error("[supervisao][esquecidos][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar os pedidos esquecidos."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

