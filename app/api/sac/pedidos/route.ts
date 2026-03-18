import { NextResponse } from "next/server"
import { ListaExtraStatus, PedidoStatus } from "@prisma/client"

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
    const pedidos = await prisma.pedido.findMany({
      where: { status: PedidoStatus.SAC },
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
        orcamento: {
          select: { id: true },
        },
        visitasTecnicas: {
          select: {
            id: true,
            dataMarcada: true,
            listaExtras: {
              where: { status: ListaExtraStatus.PENDENTE },
              select: {
                id: true,
                status: true,
                createdAt: true,
                itens: {
                  select: {
                    id: true,
                    itemId: true,
                    quantidade: true,
                    valorPraticado: true,
                    item: { select: { nome: true, valor: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const data = pedidos.map((pedido) => ({
      id: pedido.id,
      clienteId: pedido.cliente.id,
      clienteRazaoSocial: pedido.cliente.razaoSocial,
      clienteCnpj: pedido.cliente.cnpj,
      clienteEstado: pedido.cliente.estado,
      endereco: buildEndereco(pedido.cliente),
      orcamentoId: pedido.orcamento?.id ?? null,
      visitas: pedido.visitasTecnicas.map((visita) => ({
        id: visita.id,
        dataMarcada: visita.dataMarcada,
        listasExtras: visita.listaExtras.map((lista) => ({
          id: lista.id,
          status: lista.status,
          createdAt: lista.createdAt,
          itens: lista.itens.map((item) => ({
            id: item.id,
            itemId: Number(item.itemId),
            nome: item.item?.nome ?? "Item",
            quantidade: item.quantidade,
            valorPraticado: item.valorPraticado,
            valorSugerido: item.item?.valor ?? 0,
          })),
        })),
      })),
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error("[sac][pedidos][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar os pedidos do SAC."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

