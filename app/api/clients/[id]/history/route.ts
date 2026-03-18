import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { toDateInputValue } from "@/lib/date-utils"

type RouteParams = {
  id?: string
}

type RouteContext = {
  params?: RouteParams | Promise<RouteParams>
}

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" &&
  value !== null &&
  "then" in value &&
  typeof (value as Promise<unknown>).then === "function"

const toISOString = (value: Date | null): string | null =>
  value ? value.toISOString() : null

export async function GET(
  request: Request,
  context: RouteContext = {}
) {
  const rawParams = context.params
  const params = isPromise(rawParams) ? await rawParams : rawParams

  let idParam = params?.id

  if (!idParam) {
    const url = new URL(request.url)
    idParam = url.searchParams.get("id") ?? undefined

    if (!idParam) {
      const segments = url.pathname.split("/").filter(Boolean)
      idParam = segments.at(-1)
    }
  }

  if (!idParam) {
    return NextResponse.json(
      { error: "ID não informado" },
      { status: 400 }
    )
  }

  const clientId = Number.parseInt(idParam, 10)

  if (Number.isNaN(clientId)) {
    return NextResponse.json(
      { error: "ID inválido" },
      { status: 400 }
    )
  }

  try {
    const [pedidos, orcamentos] = await Promise.all([
      prisma.pedido.findMany({
        where: {
          orcamento: {
            clienteId: clientId,
          },
        },
        select: {
          id: true,
          orcamentoId: true,
          status: true,
          tipoEspecial: true,
          observacoes: true,
          detalhamento: true,
          medicaoOhmica: true,
          medicaoOhmicaMulti: true,
          createdAt: true,
          updatedAt: true,
          legacyBanco: true,
          bancoEmissor: {
            select: {
              id: true,
              nome: true,
            },
          },
          vendedor: {
            select: {
              name: true,
            },
          },
          orcamento: {
            select: {
              parcelas: true,
              primeiroVencimento: true,
              empresa: {
                select: { id: true, nome: true },
              },
              filial: {
                select: { uf: true },
              },
            },
          },
          itens: {
            select: {
              quantidade: true,
              valorUnitarioPraticado: true,
              item: {
                select: { id: true, nome: true },
              },
            },
          },
          contratoId: true,
          contrato: {
            select: {
              dataFim: true,
              status: true
            }
          }
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.orcamento.findMany({
        where: {
          clienteId: clientId,
        },
        select: {
          id: true,
          status: true,
          observacoes: true,
          createdAt: true,
          updatedAt: true,
          parcelas: true,
          primeiroVencimento: true,
          vendedor: {
            select: {
              name: true,
            },
          },
          empresa: {
            select: { id: true, nome: true },
          },
          filial: {
            select: { uf: true },
          },
          itens: {
            select: {
              quantidade: true,
              valor: true,
              item: {
                select: { id: true, nome: true },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      }),
    ])

    const pedidosTyped = pedidos as any[]
    const orcamentosTyped = orcamentos as any[]

    return NextResponse.json({
      pedidos: pedidosTyped.map((p) => ({
        id: p.id,
        orcamentoId: p.orcamentoId,
        status: p.status,
        tipoEspecial: p.tipoEspecial ?? null,
        observacoes: p.observacoes,
        detalhamento: p.detalhamento,
        medicaoOhmica: p.medicaoOhmica ?? null,
        medicaoOhmicaMulti: p.medicaoOhmicaMulti ?? null,
        createdAt: toISOString(p.createdAt),
        updatedAt: toISOString(p.updatedAt),
        vendedor: p.vendedor?.name ?? null,
        empresa: p.orcamento?.empresa?.nome ?? null,
        empresaId: p.orcamento?.empresa?.id ?? null,
        bancoEmissorId: p.bancoEmissor?.id ?? null,
        bancoEmissorNome: p.bancoEmissor?.nome ?? null,
        legacyBanco: p.legacyBanco ?? null,
        filialUf: p.orcamento?.filial?.uf ?? null,
        parcelas: p.orcamento?.parcelas ?? null,
        primeiroVencimento: toISOString(p.orcamento?.primeiroVencimento ?? null),
        total: p.itens.reduce((acc: number, item: any) => acc + item.quantidade * item.valorUnitarioPraticado, 0),
        itens: p.itens.map((item: any) => ({
          itemId: Number(item.item.id),
          nome: item.item.nome,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitarioPraticado,
          subtotal: item.quantidade * item.valorUnitarioPraticado,
        })),
        contratoId: p.contratoId,
        isContratoVigente: p.contrato ? (p.contrato.status === "OK" && toDateInputValue(p.contrato.dataFim) >= toDateInputValue(new Date())) : false,
      })),
      orcamentos: orcamentosTyped.map((o) => ({
        id: o.id,
        status: o.status,
        observacoes: o.observacoes,
        createdAt: toISOString(o.createdAt),
        updatedAt: toISOString(o.updatedAt),
        vendedor: o.vendedor?.name ?? null,
        empresa: o.empresa?.nome ?? null,
        empresaId: o.empresa?.id ?? null,
        filialUf: o.filial?.uf ?? null,
        parcelas: o.parcelas ?? null,
        primeiroVencimento: toISOString(o.primeiroVencimento ?? null),
        total: o.itens.reduce(
          (acc: number, item: any) => acc + item.quantidade * item.valor,
          0,
        ),
        itens: o.itens.map((item: any) => ({
          itemId: Number(item.item.id),
          nome: item.item.nome,
          quantidade: item.quantidade,
          valorUnitario: item.valor,
          subtotal: item.quantidade * item.valor,
        })),
      })),
    })
  } catch (error) {
    console.error(`Erro ao buscar histórico do cliente ${clientId}:`, error)
    return NextResponse.json(
      { error: "Erro ao buscar histórico" },
      { status: 500 }
    )
  }
}


