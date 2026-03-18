import { NextResponse } from "next/server"
import { PedidoStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getVendedorContext } from "@/lib/vendor-dashboard"
import { toDateInputValue } from "@/lib/date-utils"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Obtém o vendedorId do contexto (usuário logado ou impersonation para admin)
    const { vendedorId } = await getVendedorContext(searchParams)

    if (!vendedorId) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
    }

    const currentDate = new Date()
    const monthParam = Number.parseInt(searchParams.get("month") ?? "", 10)
    const yearParam = Number.parseInt(searchParams.get("year") ?? "", 10)

    const month = Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : currentDate.getMonth() + 1
    const year = Number.isFinite(yearParam) ? yearParam : currentDate.getFullYear()

    const rangeStart = new Date(year, month - 1, 1)
    const rangeEnd = new Date(year, month, 1)

    const [pedidos, budgetsCount] = await Promise.all([
      prisma.pedido.findMany({
        where: {
          vendedorId: vendedorId,
          createdAt: {
            gte: rangeStart,
            lt: rangeEnd,
          },
        },
        include: {
          cliente: {
            select: {
              id: true,
              razaoSocial: true,
              cnpj: true,
              bairro: true,
              cidade: true,
              estado: true,
              nomeSindico: true,
              emailSindico: true,
            },
          },
          itens: {
            select: {
              quantidade: true,
              valorUnitarioPraticado: true,
            },
          },
          orcamento: {
            select: {
              parcelas: true,
            },
          },
          contrato: {
            select: {
              status: true,
              dataFim: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.orcamento.count({
        where: {
          vendedorId: vendedorId,
          createdAt: {
            gte: rangeStart,
            lt: rangeEnd,
          },
        },
      }),
    ])

    const data = pedidos.map((pedido) => {
      const valorTotal = pedido.itens.reduce(
        (sum, item) => sum + item.quantidade * item.valorUnitarioPraticado,
        0,
      )

      return {
        id: pedido.id,
        status: pedido.status,
        createdAt: pedido.createdAt,
        clienteId: pedido.cliente.id,
        clienteRazaoSocial: pedido.cliente.razaoSocial,
        clienteNomeSindico: pedido.cliente.nomeSindico,
        clienteCnpj: pedido.cliente.cnpj,
        clienteCidade: pedido.cliente.cidade,
        clienteEstado: pedido.cliente.estado,
        clienteBairro: pedido.cliente.bairro,
        valorTotal,
        itensCount: pedido.itens.length,
        parcelas: pedido.orcamento?.parcelas ?? null,
        contratoId: pedido.contratoId,
        isContratoVigente: pedido.contrato ? (pedido.contrato.status === "OK" && toDateInputValue(pedido.contrato.dataFim) >= toDateInputValue(new Date())) : false,
      }
    })

    const totalValue = data
      .filter((order) => order.status !== PedidoStatus.CANCELADO)
      .reduce((sum, order) => sum + order.valorTotal, 0)

    const statusCounts = Object.values(PedidoStatus).reduce<Record<PedidoStatus, number>>((acc, status) => {
      acc[status] = 0
      return acc
    }, {} as Record<PedidoStatus, number>)

    data.forEach((pedido) => {
      statusCounts[pedido.status] = (statusCounts[pedido.status] ?? 0) + 1
    })

    return NextResponse.json({
      data,
      month,
      year,
      total: data.length,
      totalValue,
      budgetsCount,
      statusCounts,
    })
  } catch (error) {
    console.error("[vendedor][orders][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar os pedidos."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
