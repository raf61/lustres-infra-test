import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const parseDate = (value?: string | null) => {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date
}

const parseMonthYear = (month?: string | null, year?: string | null) => {
  const m = Number(month)
  const y = Number(year)
  if (!Number.isFinite(m) || m < 1 || m > 12) return null
  if (!Number.isFinite(y) || y < 1970) return null
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))
  return { start, end }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Suporta startDate/endDate (para períodos) ou month/year (retrocompatibilidade)
    const startDateParam = parseDate(searchParams.get("startDate"))
    const endDateParam = parseDate(searchParams.get("endDate"))
    const month = searchParams.get("month")
    const year = searchParams.get("year")

    let range: { start: Date; end: Date } | null = null

    if (startDateParam && endDateParam) {
      // Usa startDate/endDate se fornecidos
      range = { start: startDateParam, end: new Date(endDateParam.getTime() + 24 * 60 * 60 * 1000 - 1) }
    } else if (month && year) {
      // Fallback para month/year
      range = parseMonthYear(month, year)
    }
    // Se nenhum filtro de data, retorna todos (para "Todo período")

    const comissoes = await (prisma as any).comissao.findMany({
      where: range ? {
        createdAt: { gte: range.start, lt: range.end },
      } : {},
      include: {
        contaPagar: {
          select: { id: true, status: true },
        },
        pedido: {
          select: {
            id: true,
            cliente: { select: { razaoSocial: true } },
            itens: { select: { quantidade: true, valorUnitarioPraticado: true } },
            orcamento: {
              select: {
                vendedorId: true,
                vendedor: { select: { name: true, fullname: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    console.log(comissoes)

    const detalhe = (comissoes as any[]).map((c) => {
      const itens: Array<{ quantidade: number; valorUnitarioPraticado: number }> = c.pedido?.itens ?? []
      const totalPedido = itens.reduce((sum: number, it) => sum + it.quantidade * it.valorUnitarioPraticado, 0)
      return {
        id: c.id,
        vencimento: c.vencimento,
        pedidoId: c.pedidoId,
        cliente: c.pedido?.cliente?.razaoSocial ?? "",
        valorPedido: totalPedido,
        valorComissao: c.valor,
        contaPagarId: c.contaPagar?.id ?? null,
        contaPagarStatus: c.contaPagar?.status ?? null,
        vendedorId: c.pedido?.orcamento?.vendedorId ?? null,
        vendedorNome: c.pedido?.orcamento?.vendedor?.fullname ?? c.pedido?.orcamento?.vendedor?.name ?? "Vendedor",
      }
    })

    const agrupadoMap = new Map<
      string,
      { vendedorId: string; vendedorNome: string; vendido: number; totalComissao: number }
    >()
    for (const d of detalhe) {
      const vendId = d.vendedorId ?? "sem-vendedor"
      const vendNome = d.vendedorNome ?? "Vendedor"
      const atual = agrupadoMap.get(vendId) ?? { vendedorId: vendId, vendedorNome: vendNome, vendido: 0, totalComissao: 0 }
      agrupadoMap.set(vendId, {
        vendedorId: vendId,
        vendedorNome: vendNome,
        vendido: atual.vendido + d.valorPedido,
        totalComissao: atual.totalComissao + d.valorComissao,
      })
    }

    return NextResponse.json({
      data: {
        detalhe,
        agrupado: Array.from(agrupadoMap.values()),
      },
    })
  } catch (error) {
    console.error("[COMISSOES_LIST]", error)
    return NextResponse.json({ error: "Erro ao listar comissões" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { pedidoId, valor, vencimento } = body

    if (!pedidoId || !valor || !vencimento) {
      return NextResponse.json({ error: "pedidoId, valor e vencimento são obrigatórios" }, { status: 400 })
    }

    const valorNum = Number(valor)
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
    }

    // Ajuste para fuso de Brasília (UTC-3)
    const vencimentoDate = new Date(vencimento)
    if (!vencimento.includes("T")) {
      vencimentoDate.setUTCHours(3)
    }

    if (isNaN(vencimentoDate.getTime())) {
      return NextResponse.json({ error: "Vencimento inválido" }, { status: 400 })
    }

    // Verificar que o pedido existe
    const pedido = await prisma.pedido.findUnique({
      where: { id: Number(pedidoId) },
      include: {
        orcamento: { select: { vendedorId: true, vendedor: { select: { fullname: true, name: true } } } },
        vendedor: { select: { fullname: true, name: true } },
      },
    })
    if (!pedido) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
    }

    // Encontrar/criar categoria Comissões na ContaPagar
    let categoriaComissaoId: number | null = null
    try {
      const cat = await (prisma as any).contaPagarCategoria.findFirst({ where: { nome: "Comissões" } })
      categoriaComissaoId = cat?.id ?? null
    } catch (_) { }

    const vendedorNome =
      pedido.orcamento?.vendedor?.fullname ??
      pedido.orcamento?.vendedor?.name ??
      pedido.vendedor?.fullname ??
      pedido.vendedor?.name ??
      "Vendedor"

    // Criar comissão + conta a pagar em transação
    const comissao = await (prisma as any).comissao.create({
      data: {
        createdAt: new Date(),
        vencimento: vencimentoDate,
        pedidoId: Number(pedidoId),
        valor: valorNum,
      },
    })

    // Criar conta a pagar vinculada
    await (prisma as any).contaPagar.create({
      data: {
        descricao: `Comissão pedido #${pedidoId} - ${vendedorNome}`,
        categoriaId: categoriaComissaoId,
        valor: valorNum,
        status: 0,
        vencimento: vencimentoDate,
        pagoEm: null,
        comissaoId: comissao.id,
      },
    })

    return NextResponse.json({ data: comissao }, { status: 201 })
  } catch (error) {
    console.error("[COMISSAO_CREATE]", error)
    return NextResponse.json({ error: "Erro ao criar comissão" }, { status: 500 })
  }
}
