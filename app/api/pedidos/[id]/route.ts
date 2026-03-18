import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

import { auth } from "@/auth"
import { toDateInputValue } from "@/lib/date-utils"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const pedidoId = Number.parseInt(id, 10)
    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 })
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        cliente: {
          select: {
            id: true,
            razaoSocial: true,
            cnpj: true,
            telefoneCondominio: true,
            celularCondominio: true,
            nomeSindico: true,
            telefoneSindico: true,
            gerentesAdministradora: {
              include: {
                gerente: {
                  select: { id: true, nome: true, celular: true, whatsapp: true }
                }
              }
            }
          },
        },
        vendedor: {
          select: {
            id: true,
            name: true,
          },
        },
        bancoEmissor: {
          select: {
            id: true,
            nome: true,
            bancoCodigo: true,
          },
        },
        orcamento: {
          select: {
            id: true,
            parcelas: true,
            primeiroVencimento: true,
            empresa: {
              select: {
                id: true,
                nome: true,
              },
            },
            filial: {
              select: {
                id: true,
                uf: true,
              },
            },
          },
        },
        itens: {
          include: {
            item: {
              select: {
                id: true,
                nome: true,
              },
            },
          },
          orderBy: { id: "asc" },
        },
        contrato: {
          select: {
            id: true,
            status: true,
            dataFim: true,
          },
        },
      },
    })

    if (!pedido) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
    }

    // Calculate total from items
    const total = pedido.itens.reduce(
      (sum, item) => sum + item.quantidade * item.valorUnitarioPraticado,
      0
    )

    const data = {
      id: pedido.id,
      orcamentoId: pedido.orcamentoId,
      status: pedido.status,
      tipoEspecial: pedido.tipoEspecial ?? null,
      geradoART: pedido.geradoART ?? null,
      observacoes: pedido.observacoes,
      detalhamento: pedido.detalhamento,
      medicaoOhmica: pedido.medicaoOhmica,
      medicaoOhmicaMulti: pedido.medicaoOhmicaMulti,
      createdAt: pedido.createdAt.toISOString(),
      updatedAt: pedido.updatedAt.toISOString(),

      // Cliente
      clienteId: pedido.clienteId,
      cliente: pedido.cliente
        ? {
          id: pedido.cliente.id,
          razaoSocial: pedido.cliente.razaoSocial,
          cnpj: pedido.cliente.cnpj,
          telefoneCondominio: pedido.cliente.telefoneCondominio,
          celularCondominio: pedido.cliente.celularCondominio,
          nomeSindico: pedido.cliente.nomeSindico,
          telefoneSindico: pedido.cliente.telefoneSindico,
          gerentesAdministradora: pedido.cliente.gerentesAdministradora,
        }
        : null,
      // Vendedor
      vendedorId: pedido.vendedorId,
      vendedor: pedido.vendedor
        ? {
          id: pedido.vendedor.id,
          name: pedido.vendedor.name,
        }
        : null,

      // Banco
      bancoEmissorId: pedido.bancoEmissorId,
      bancoEmissor: pedido.bancoEmissor
        ? {
          id: pedido.bancoEmissor.id,
          nome: pedido.bancoEmissor.nome,
          bancoCodigo: pedido.bancoEmissor.bancoCodigo,
        }
        : null,
      legacyBanco: pedido.legacyBanco,

      // Empresa/Filial from orcamento
      empresa: pedido.orcamento?.empresa
        ? {
          id: pedido.orcamento.empresa.id,
          nome: pedido.orcamento.empresa.nome,
        }
        : null,
      filialUf: pedido.orcamento?.filial?.uf ?? null,

      // Parcelas from orcamento
      parcelas: pedido.orcamento?.parcelas ?? null,
      primeiroVencimento: pedido.orcamento?.primeiroVencimento?.toISOString() ?? null,

      // Total calculated from items
      total,

      // Items
      itens: pedido.itens.map((item) => ({
        id: item.id,
        itemId: Number(item.itemId),
        nome: item.item?.nome ?? "Item",
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitarioPraticado,
        subtotal: item.quantidade * item.valorUnitarioPraticado,
      })),
      contratoId: pedido.contratoId,
      contrato: pedido.contrato,
      isContratoVigente: pedido.contrato ? (pedido.contrato.status === "OK" && toDateInputValue(pedido.contrato.dataFim) >= toDateInputValue(new Date())) : false,
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("[pedido][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar o pedido."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const pedidoId = Number.parseInt(id, 10)
    if (Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "ID do pedido inválido." }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))

    // Check if pedido exists
    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { id: true, status: true },
    })

    if (!pedido) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
    }

    const session = await auth()
    const role = session?.user?.role as string
    const isAdminOrFinance = ["MASTER", "ADMINISTRADOR", "FINANCEIRO"].includes(role)

    if (pedido.status === "CONCLUIDO" && !isAdminOrFinance) {
      return NextResponse.json({ error: "Pedidos concluídos não podem ser alterados." }, { status: 400 })
    }

    // Build update data
    const updateData: { medicaoOhmica?: number | null; medicaoOhmicaMulti?: any; observacoes?: string | null; detalhamento?: string | null } = {}

    if ("medicaoOhmica" in body) {
      const medicao = body.medicaoOhmica
      if (medicao === null || medicao === "" || medicao === undefined) {
        updateData.medicaoOhmica = null
      } else {
        const parsed = Number.parseFloat(String(medicao))
        if (Number.isNaN(parsed)) {
          return NextResponse.json({ error: "Medição ôhmica inválida." }, { status: 400 })
        }
        updateData.medicaoOhmica = parsed
      }
    }

    if ("medicaoOhmicaMulti" in body) {
      updateData.medicaoOhmicaMulti = body.medicaoOhmicaMulti ?? null
    }

    if ("observacoes" in body) {
      updateData.observacoes = body.observacoes ?? null
    }

    if ("detalhamento" in body) {
      updateData.detalhamento = body.detalhamento ?? null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 })
    }

    const updated = await prisma.pedido.update({
      where: { id: pedidoId },
      data: updateData,
      select: {
        id: true,
        medicaoOhmica: true,
        medicaoOhmicaMulti: true,
        observacoes: true,
        detalhamento: true,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("[pedido][PATCH]", error)
    const message = error instanceof Error ? error.message : "Não foi possível atualizar o pedido."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

