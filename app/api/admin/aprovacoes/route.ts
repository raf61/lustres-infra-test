import { NextResponse } from "next/server"
import { PedidoStatus, Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"


const PAGE_SIZE = 30

type AprovacaoRow = {
  id: number
  status: PedidoStatus
  tipoEspecial: Prisma.PedidoTipoEspecial | null
  cliente: {
    id: number
    razaoSocial: string
    cnpj: string
  }
  orcamento: {
    id: number
    empresaId: number | null
    parcelas: number | null
    primeiroVencimento: Date | null
  } | null
  itens: { quantidade: number; valorUnitarioPraticado: number }[]
  medicaoOhmica: number | null
  medicaoOhmicaMulti: any | null
  createdAt: Date
}

const buildEndereco = (cliente: {
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
}) => {
  const partes: string[] = []
  if (cliente.logradouro) {
    const numero = cliente.numero ? `, ${cliente.numero}` : ""
    partes.push(`${cliente.logradouro}${numero}`)
  }
  if (cliente.complemento) partes.push(cliente.complemento)
  const cidadeEstado = [cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(" - ")
  if (cidadeEstado) partes.push(cidadeEstado)
  if (cliente.cep) partes.push(cliente.cep)
  const endereco = partes.join(" | ").trim()
  return endereco.length > 0 ? endereco : "Endereço não informado"
}

const mapPedido = (pedido: AprovacaoRow & { cliente: any }) => {
  const valorTotal = pedido.itens.reduce(
    (sum, item) => sum + item.quantidade * item.valorUnitarioPraticado,
    0,
  )
  return {
    id: pedido.id,
    status: pedido.status,
    tipoEspecial: pedido.tipoEspecial,
    clienteId: pedido.cliente.id,
    clienteRazaoSocial: pedido.cliente.razaoSocial,
    clienteCnpj: pedido.cliente.cnpj,
    clienteEndereco: buildEndereco(pedido.cliente),
    orcamentoId: pedido.orcamento?.id ?? null,
    empresaId: pedido.orcamento?.empresaId ?? null,
    parcelas: pedido.orcamento?.parcelas ?? null,
    primeiroVencimento: pedido.orcamento?.primeiroVencimento ?? null,
    valorTotal,
    createdAt: pedido.createdAt,
    medicaoOhmica: pedido.medicaoOhmica,
    medicaoOhmicaMulti: pedido.medicaoOhmicaMulti,
  }
}

export async function GET(request: Request) {
  //generateCartaEndossoPdf({ pedidoId: 10000})

  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get("mode") ?? "pendentes"
    const page = Number.parseInt(searchParams.get("page") ?? "1", 10)
    const pageNumber = Number.isNaN(page) || page < 1 ? 1 : page

    if (mode === "historico") {
      const [total, pedidos] = await prisma.$transaction([
        prisma.pedido.count({ where: { status: PedidoStatus.CONCLUIDO } }),
        prisma.pedido.findMany({
          where: { status: PedidoStatus.CONCLUIDO },
          select: {
            id: true,
            status: true,
            tipoEspecial: true,
            createdAt: true,
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
                cep: true,
              },
            },
            orcamento: { select: { id: true, empresaId: true, parcelas: true, primeiroVencimento: true } },
            itens: { select: { quantidade: true, valorUnitarioPraticado: true } },
            medicaoOhmica: true,
            medicaoOhmicaMulti: true,
          },
          orderBy: { createdAt: "desc" },
          skip: (pageNumber - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
      ])

      return NextResponse.json({
        data: pedidos.map(mapPedido),
        total,
        page: pageNumber,
        pageSize: PAGE_SIZE,
      })
    }

    // Pendentes (AGUARDANDO_APROVACAO_FINAL)
    const pedidos = await prisma.pedido.findMany({
      where: { status: PedidoStatus.AGUARDANDO_APROVACAO_FINAL },
      select: {
        id: true,
        status: true,
        tipoEspecial: true,
        createdAt: true,
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
            cep: true,
          },
        },
        orcamento: { select: { id: true, empresaId: true, parcelas: true, primeiroVencimento: true } },
        itens: { select: { quantidade: true, valorUnitarioPraticado: true } },
        medicaoOhmica: true,
        medicaoOhmicaMulti: true,
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({
      data: pedidos.map(mapPedido),
    })
  } catch (error) {
    console.error("[admin][aprovacoes][GET]", error)
    const message =
      error instanceof Error ? error.message : "Não foi possível carregar as aprovações."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

