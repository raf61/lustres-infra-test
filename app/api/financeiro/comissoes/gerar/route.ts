import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

type Payload = {
  dataCorte?: string
  vendedorIds?: string[]
}

const dateOnly = (value: string) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Payload
    const { dataCorte, vendedorIds } = body

    if (!dataCorte) {
      return NextResponse.json({ error: "dataCorte é obrigatória (yyyy-mm-dd)" }, { status: 400 })
    }

    const cutoff = dateOnly(dataCorte)
    if (!cutoff) {
      return NextResponse.json({ error: "dataCorte inválida" }, { status: 400 })
    }
    // Vendedores-alvo (role VENDEDOR)
    const vendedores = await prisma.user.findMany({
      where: {
        role: "VENDEDOR",
        ...(Array.isArray(vendedorIds) && vendedorIds.length > 0 ? { id: { in: vendedorIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        dadosCadastrais: {
          select: {
            metaMin: true,
            metaMinPerc: true,
            metaNormalPerc: true,
          },
        },
      },
    })

    if (vendedores.length === 0) {
      return NextResponse.json({ error: "Nenhum vendedor elegível encontrado" }, { status: 404 })
    }

    const vendedoresComMeta = vendedores.filter((v) => {
      const cad = v.dadosCadastrais
      return cad && cad.metaMin !== null && cad.metaMinPerc !== null && cad.metaNormalPerc !== null
    })
    const vendedoresSemMeta = vendedores.filter((v) => !vendedoresComMeta.some((ok) => ok.id === v.id))

    if (vendedoresComMeta.length === 0) {
      return NextResponse.json(
        { error: "Nenhum vendedor possui metas configuradas", skippedVendedores: vendedoresSemMeta.map((v) => v.id) },
        { status: 400 },
      )
    }

    // Pedidos elegíveis conforme legado (usa vendedor do orçamento)
    const pedidosElegiveis = await prisma.pedido.findMany({
      where: {
        geradoComissao: false,
        orcamento: {
          vendedorId: { in: vendedoresComMeta.map((v) => v.id) },
        },
        debitos: {
          some: {
            stats: 2, // recebido
            dataOcorrencia: { lte: cutoff },
          },
        },
      },
      include: {
        itens: { select: { quantidade: true, valorUnitarioPraticado: true } },
        orcamento: { select: { vendedorId: true, vendedor: { select: { id: true, name: true, fullname: true } } } },
        vendedor: { select: { id: true, name: true, fullname: true } }, // fallback, se existir
      },
    })

    if (pedidosElegiveis.length === 0) {
      return NextResponse.json({ data: { criadas: 0, pedidosProcessados: 0, skippedVendedores: vendedoresSemMeta.map((v) => v.id) } })
    }

    // Totais vendidos por vendedor
    const totalPorVendedor = new Map<string, number>()
    const totalPedido = (itens: { quantidade: number; valorUnitarioPraticado: number }[]) =>
      itens.reduce((sum, item) => sum + item.quantidade * item.valorUnitarioPraticado, 0)

    for (const pedido of pedidosElegiveis) {
      const vendId = pedido.orcamento?.vendedorId ?? pedido.vendedor?.id ?? null
      if (!vendId) continue
      const atual = totalPorVendedor.get(vendId) ?? 0
      totalPorVendedor.set(vendId, atual + totalPedido(pedido.itens))
    }

    // Percentuais por vendedor conforme metas
    const percentPorVendedor = new Map<string, number>()
    for (const vend of vendedoresComMeta) {
      const total = totalPorVendedor.get(vend.id) ?? 0
      const metaMin = Number(vend.dadosCadastrais?.metaMin ?? 0)
      const percAte = Number(vend.dadosCadastrais?.metaMinPerc ?? 0)
      const percAcima = Number(vend.dadosCadastrais?.metaNormalPerc ?? 0)
      const perc = total <= metaMin ? percAte : percAcima
      percentPorVendedor.set(vend.id, perc)
    }

    const comissaoClient = (prisma as any).comissao
    const maxId = (await comissaoClient.aggregate({ _max: { id: true } }))._max.id ?? 0
    let nextId = maxId
    const comissoesData: Array<{
      id: number
      createdAt: Date
      vencimento: Date
      pedidoId: number
      valor: number
    }> = []
    const pedidoIds: number[] = []
    let categoriaComissaoId: number | null = null
    const contasPagarData: Array<{
      descricao: string
      categoriaId: number | null
      valor: number
      status: number
      vencimento: Date
      pagoEm: Date | null
      comissaoId: number
    }> = []
    try {
      const existingCat = await (prisma as any).contaPagarCategoria.findFirst({ where: { nome: "Comissões" } })
      if (existingCat) {
        categoriaComissaoId = existingCat.id
      } else {
        const createdCat = await (prisma as any).contaPagarCategoria.create({ data: { nome: "Comissões" } })
        categoriaComissaoId = createdCat.id
      }
    } catch (e) {
      console.error("⚠️  Falha ao garantir categoria 'Comissões':", e)
    }

    for (const pedido of pedidosElegiveis) {
      const vendId = pedido.orcamento?.vendedorId ?? pedido.vendedor?.id ?? null
      if (!vendId) continue
      const perc = percentPorVendedor.get(vendId)
      // no legado, fallback 0.5m (50%) se percent não encontrado
      const percUsado = perc === undefined || Number.isNaN(perc) ? 50 : perc
      const valorPedido = totalPedido(pedido.itens)
      const valorComissao = Number(((valorPedido * percUsado) / 100).toFixed(2))
      const vendedorNome =
        pedido.orcamento?.vendedor?.fullname ??
        pedido.orcamento?.vendedor?.name ??
        pedido.vendedor?.fullname ??
        pedido.vendedor?.name ??
        "Vendedor"
      nextId += 1
      comissoesData.push({
        id: nextId,
        createdAt: cutoff,
        vencimento: new Date(cutoff.getTime() + 24 * 60 * 60 * 1000), // D+1 conforme legado
        pedidoId: pedido.id,
        valor: valorComissao,
      })
      if (categoriaComissaoId !== null) {
        contasPagarData.push({
          descricao: `Comissão pedido #${pedido.id} - ${vendedorNome}`,
          categoriaId: categoriaComissaoId,
          valor: valorComissao,
          status: 0,
          vencimento: new Date(cutoff.getTime() + 24 * 60 * 60 * 1000),
          pagoEm: null,
          comissaoId: nextId,
        })
      }
      pedidoIds.push(pedido.id)
    }

    if (comissoesData.length === 0) {
      return NextResponse.json({ data: { criadas: 0, pedidosProcessados: pedidosElegiveis.length, skippedVendedores: vendedoresSemMeta.map((v) => v.id) } })
    }

    await prisma.$transaction([
      comissaoClient.createMany({ data: comissoesData, skipDuplicates: true }),
      ...(contasPagarData.length > 0
        ? [(prisma as any).contaPagar.createMany({ data: contasPagarData, skipDuplicates: true })]
        : []),
      prisma.pedido.updateMany({ where: { id: { in: pedidoIds } }, data: { geradoComissao: true } }),
    ])

    return NextResponse.json({
      data: {
        criadas: comissoesData.length,
        pedidosProcessados: pedidoIds.length,
        skippedVendedores: vendedoresSemMeta.map((v) => v.id),
        contasCriadas: contasPagarData.length,
      },
    })
  } catch (error) {
    console.error("[COMISSOES_GERAR]", error)
    return NextResponse.json({ error: "Erro ao gerar comissões" }, { status: 500 })
  }
}

