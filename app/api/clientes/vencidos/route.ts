import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getClienteVencimentoDate, isClienteVencido } from "@/lib/client-status"

/**
 * ⚠️ NOTA: Esta classificação de "vencido" pode ser temporária.
 *
 * Clientes considerados VENCIDOS:
 * - Apenas ATIVOS
 * - ultimaManutencao vence no primeiro dia do mês seguinte do ano seguinte
 * - Vencido quando now > vencimentoDate (início do mês de vencimento)
 */

export type ClienteVencido = {
  id: number
  cnpj: string
  razaoSocial: string
  cidade: string | null
  estado: string | null
  vendedorNome: string | null
  ultimoPedidoData: string | null
  mesVencimento: string // Ex: "Mar/2025"
  diasVencido: number
}

export async function GET() {
  try {
    const now = new Date()

    const clientes = await prisma.client.findMany({
      where: {
        categoria: "ATIVO",
        ultimaManutencao: { not: null },
      },
      select: {
        id: true,
        cnpj: true,
        razaoSocial: true,
        categoria: true,
        cidade: true,
        estado: true,
        ultimaManutencao: true,
        vendedor: {
          select: { name: true },
        },
      },
    })

    // Filtrar clientes vencidos
    const clientesVencidos: ClienteVencido[] = []
    const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

    for (const cliente of clientes) {
      if (!isClienteVencido(cliente.categoria, cliente.ultimaManutencao)) continue

      const vencimentoDate = getClienteVencimentoDate(cliente.ultimaManutencao)
      if (!vencimentoDate) continue

      const mesVencimento = vencimentoDate.getMonth()
      const anoVencimento = vencimentoDate.getFullYear()
      const diasVencido = Math.floor((now.getTime() - vencimentoDate.getTime()) / (1000 * 60 * 60 * 24))

        clientesVencidos.push({
          id: cliente.id,
          cnpj: cliente.cnpj,
          razaoSocial: cliente.razaoSocial,
          cidade: cliente.cidade,
          estado: cliente.estado,
          vendedorNome: cliente.vendedor?.name ?? null,
          ultimoPedidoData: cliente.ultimaManutencao?.toISOString() ?? null,
          mesVencimento: `${MESES_ABREV[mesVencimento]}/${anoVencimento}`,
          diasVencido: Math.max(0, diasVencido),
        })
    }

    // Ordenar por dias vencido (mais antigos primeiro)
    clientesVencidos.sort((a, b) => b.diasVencido - a.diasVencido)

    return NextResponse.json({
      data: clientesVencidos,
      total: clientesVencidos.length,
    })
  } catch (error) {
    console.error("[clientes][vencidos][GET]", error)
    const message = error instanceof Error ? error.message : "Erro ao buscar clientes vencidos"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
