import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { getTecnicoContext } from "@/lib/tecnico-dashboard"
import { buildEndereco } from "@/lib/enderecos"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const { tecnicoId } = await getTecnicoContext(searchParams)
    if (!tecnicoId) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
    }

    // Calcula os limites do dia de hoje
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    // Busca apenas visitas de hoje e pendentes (anteriores a hoje)
    // Técnico NÃO pode ver visitas futuras
    const visitas = (await prisma.visitaTecnica.findMany({
      where: {
        tecnicoId,
        status: { in: ["AGUARDANDO", "EM_EXECUCAO", "ANALISE_NAO_AUTORIZADO"] },
        // Visitas de hoje OU pendentes (datas anteriores a hoje)
        dataMarcada: { lte: todayEnd },
      },
      select: {
        id: true,
        tecnicoId: true,
        observacao: true,
        dataMarcada: true,
        status: true,
        dataRegistroInicio: true,
        dataRegistroFim: true,
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
        pedido: {
          select: {
            id: true,
            observacoes: true,
            tipoEspecial: true,
            detalhamento: true,
            itens: {
              select: {
                quantidade: true,
                item: {
                  select: {
                    nome: true,
                    categoria: true,
                  },
                },
              },
            },
            visitasTecnicas: {
              select: {
                id: true,
                listaExtras: {
                  where: { status: "APROVADO" },
                  select: { id: true },
                },
              },
            },
          },
        },
        orcamento: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { dataMarcada: "asc" },
    } as any)) as any[]

    const data = visitas.map((visita) => {
      const visitasDoPedido = visita.pedido?.visitasTecnicas ?? []
      const totalVisitasDoPedido = visitasDoPedido.length
      const passouPeloSac = visitasDoPedido.some((v: any) => v.listaExtras.length > 0)

      const itemsDeProduto = (visita.pedido?.itens ?? []).filter((it: any) => it.item?.categoria === "Produto")
      const temItensProduto = itemsDeProduto.length > 0

      let tipoVisita: string | null = null
      if (visita.pedido?.tipoEspecial === "OS") {
        tipoVisita = "Ord. Serv."
      } else if (passouPeloSac) {
        tipoVisita = "SAC"
      } else if (totalVisitasDoPedido <= 1) {
        tipoVisita = temItensProduto ? "Primeira visita com peças" : "Primeira visita"
      }

      // Materiais do Pedido (itens do tipo Produto)
      let sacMaterials: Array<{ nome: string; quantidade: number }> | null = null
      if (visita.pedido?.tipoEspecial !== "OS" && temItensProduto) {
        sacMaterials = itemsDeProduto.map((it: any) => ({
          nome: it.item?.nome ?? "Item",
          quantidade: it.quantidade,
        }))
      }

      return {
        id: visita.id,
        tecnicoId: visita.tecnicoId,
        observacao: visita.observacao ?? null,
        pedidoId: visita.pedido?.id ?? null,
        pedidoObservacoes: visita.pedido?.observacoes ?? null,
        pedidoTipoEspecial: visita.pedido?.tipoEspecial ?? null,
        pedidoDetalhamento: visita.pedido?.detalhamento ?? null,
        orcamentoId: visita.orcamento.id,
        clienteId: visita.cliente.id,
        clienteRazaoSocial: visita.cliente.razaoSocial,
        clienteCnpj: visita.cliente.cnpj,
        endereco: buildEndereco(visita.cliente),
        dataMarcada: visita.dataMarcada,
        status: visita.status,
        dataRegistroInicio: visita.dataRegistroInicio,
        dataRegistroFim: visita.dataRegistroFim,
        tipoVisita,
        sacMaterials,
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error("[tecnico][visitas][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar as visitas do técnico."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


