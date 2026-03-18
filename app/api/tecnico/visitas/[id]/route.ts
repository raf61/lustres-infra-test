import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type DocumentoOperacionalAssinaturaRaw = {
  id: number
  nomeCompletoAssinante: string
  cpfAssinante: string | null
  url: string | null
  localizacao: string
  dadosExtras: any
}

type DocumentoOperacionalRaw = {
  id: number
  tipo: any
  status: any
  url: string | null
  dadosExtras: any
  assinaturas: DocumentoOperacionalAssinaturaRaw[]
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const visitaId = Number.parseInt(id, 10)
    if (Number.isNaN(visitaId)) {
      return NextResponse.json({ error: "ID da visita inválido." }, { status: 400 })
    }

    const visita = (await prisma.visitaTecnica.findUnique({
      where: { id: visitaId },
      select: {
        id: true,
        status: true,
        dataMarcada: true,
        observacao: true,
        dataRegistroInicio: true,
        dataRegistroFim: true,
        checklist: true,
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
            quantidadeAndares: true,
            quantidadeSPDA: true,
            especificacaoCondominio: true,
          },
        },
        tecnico: {
          select: {
            id: true,
            name: true,
            fullname: true,
            dadosCadastrais: {
              select: {
                cpf: true,
              },
            },
          },
        },
        pedido: {
          select: {
            id: true,
            status: true,
            tipoEspecial: true,
            observacoes: true,
            detalhamento: true,
            medicaoOhmica: true,
            medicaoOhmicaMulti: true,
            visitasTecnicas: {
              select: {
                id: true,
                listaExtras: {
                  where: { status: "APROVADO" },
                  select: { id: true },
                },
              },
            },
            itens: {
              select: {
                quantidade: true,
                valorUnitarioPraticado: true,
                itemId: true,
                item: {
                  select: {
                    nome: true,
                    categoria: true,
                    valor: true,
                  },
                },
              },
            },
            documentosOperacionais: {
              include: {
                assinaturas: true,
              },
            },
          },
        },
        orcamento: {
          select: {
            id: true,
            status: true,
            itens: {
              select: {
                quantidade: true,
                valor: true,
                itemId: true,
                item: {
                  select: {
                    nome: true,
                    categoria: true,
                    valor: true,
                  },
                },
              },
            },
          },
        },
      },
    } as any)) as any

    if (!visita) {
      return NextResponse.json({ error: "Visita técnica não encontrada." }, { status: 404 })
    }

    if (visita.status !== "EM_EXECUCAO" && visita.status !== "FINALIZADO") {
      return NextResponse.json(
        { error: "Acesso permitido apenas para visitas em execução ou finalizadas." },
        { status: 403 },
      )
    }

    const itensProduto = await prisma.item.findMany({
      where: { categoria: "Produto" },
      select: {
        id: true,
        nome: true,
        categoria: true,
        valor: true,
      },
      orderBy: { nome: "asc" },
    })

    const serializePedidoItens = (
      itens: {
        quantidade: number
        valorUnitarioPraticado: number
        itemId: bigint
        item?: { nome: string; categoria: string | null; valor: number }
      }[],
    ) =>
      itens.map((item) => ({
        quantidade: item.quantidade,
        valorUnitarioPraticado: item.valorUnitarioPraticado,
        itemId: Number(item.itemId),
        nome: item.item?.nome ?? "Item",
        categoria: item.item?.categoria ?? null,
        valorReferencia: item.item?.valor ?? item.valorUnitarioPraticado ?? 0,
      }))

    const serializeOrcamentoItens = (
      itens: {
        quantidade: number
        valor: number
        itemId: bigint
        item?: { nome: string; categoria: string | null; valor: number }
      }[],
    ) =>
      itens.map((item) => ({
        quantidade: item.quantidade,
        valor: item.valor,
        itemId: Number(item.itemId),
        nome: item.item?.nome ?? "Item",
        categoria: item.item?.categoria ?? null,
        valorReferencia: item.item?.valor ?? item.valor ?? 0,
      }))

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

    const sacMaterials: Array<{ nome: string; quantidade: number }> =
      visita.pedido?.tipoEspecial !== "OS" && temItensProduto
        ? itemsDeProduto.map((it: any) => ({
          nome: it.item?.nome ?? "Item",
          quantidade: it.quantidade,
        }))
        : []

    return NextResponse.json({
      id: visita.id,
      status: visita.status,
      dataMarcada: visita.dataMarcada,
      observacao: visita.observacao ?? null,
      dataRegistroInicio: visita.dataRegistroInicio,
      dataRegistroFim: visita.dataRegistroFim,
      checklist: visita.checklist,
      tipoVisita,
      sacMaterials: sacMaterials.length > 0 ? sacMaterials : null,
      cliente: {
        id: visita.cliente.id,
        razaoSocial: visita.cliente.razaoSocial,
        cnpj: visita.cliente.cnpj,
        quantidadeAndares: visita.cliente.quantidadeAndares ?? null,
        quantidadeSPDA: visita.cliente.quantidadeSPDA ?? null,
        especificacaoCondominio: visita.cliente.especificacaoCondominio ?? null,
        endereco: [
          visita.cliente.logradouro
            ? `${visita.cliente.logradouro}${visita.cliente.numero ? `, ${visita.cliente.numero}` : ""}`
            : null,
          visita.cliente.complemento,
          [visita.cliente.bairro, visita.cliente.cidade, visita.cliente.estado].filter(Boolean).join(" - "),
        ]
          .filter(Boolean)
          .join(" | "),
      },
      tecnico: visita.tecnico
        ? {
          id: visita.tecnico.id,
          nome: visita.tecnico.fullname ?? visita.tecnico.name,
          dadosCadastrais: {
            cpf: visita.tecnico.dadosCadastrais?.cpf ?? null,
          },
        }
        : null,
      pedido: visita.pedido
        ? {
          id: visita.pedido.id,
          status: visita.pedido.status,
          tipoEspecial: visita.pedido.tipoEspecial ?? null,
          observacoes: visita.pedido.observacoes ?? null,
          detalhamento: visita.pedido.detalhamento ?? null,
          medicaoOhmica: visita.pedido.medicaoOhmica,
          medicaoOhmicaMulti: visita.pedido.medicaoOhmicaMulti,
          itens: serializePedidoItens(visita.pedido.itens as any),
          documentosOperacionais: (visita.pedido.documentosOperacionais ?? []).map((doc: DocumentoOperacionalRaw) => ({
            id: doc.id,
            tipo: doc.tipo,
            status: doc.status,
            url: doc.url,
            dadosExtras: doc.dadosExtras,
            assinaturas: doc.assinaturas.map((assinatura: DocumentoOperacionalAssinaturaRaw) => ({
              id: assinatura.id,
              nomeCompletoAssinante: assinatura.nomeCompletoAssinante,
              cpfAssinante: assinatura.cpfAssinante,
              url: assinatura.url,
              localizacao: assinatura.localizacao,
              dadosExtras: assinatura.dadosExtras,
            })),
          })),
        }
        : null,
      orcamento: visita.orcamento
        ? {
          id: visita.orcamento.id,
          status: visita.orcamento.status,
          itens: serializeOrcamentoItens(visita.orcamento.itens as any),
        }
        : null,
      itensProduto: itensProduto.map((item) => ({
        id: Number(item.id),
        nome: item.nome,
        categoria: item.categoria,
        valorReferencia: item.valor,
      })),
    })
  } catch (error) {
    console.error("[tecnico][visitas][id][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar a visita."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

