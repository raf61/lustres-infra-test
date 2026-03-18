import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
// import { parseDateEndOfDay } from "@/lib/date-utils" // Unused
import { getExportARTPreview, executeExportART } from "@/domain/pedido/export-art-usecase"

/**
 * GET - Preview da exportação (quantos pedidos serão afetados)
 * Busca pedidos CONCLUÍDOS criados até a data limite
 */
/**
 * GET - Preview da exportação (lista de pedidos elegíveis)
 * Busca todos os pedidos CONCLUÍDOS e não exportados
 */
export async function GET() {
  try {
    const preview = await getExportARTPreview(prisma)

    return NextResponse.json({
      quantidadePedidos: preview.quantidadePedidos,
      pedidos: preview.pedidos,
      message: preview.quantidadePedidos > 0
        ? `${preview.quantidadePedidos} pedido(s) concluído(s) disponíveis para exportação`
        : "Nenhum pedido pendente para exportar",
    })
  } catch (error) {
    console.error("[EXPORT_ART_PREVIEW]", error)
    return NextResponse.json(
      { error: "Erro ao buscar preview" },
      { status: 500 }
    )
  }
}

/**
 * POST - Executa a exportação e retorna CSV
 * Exporta pedidos CONCLUÍDOS criados até a data limite
 */
/**
 * POST - Executa a exportação e retorna CSV
 * Exporta pedidos selecionados
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const pedidoIds = body?.pedidoIds // Array de IDs

    if (!pedidoIds || !Array.isArray(pedidoIds) || pedidoIds.length === 0) {
      return NextResponse.json(
        { error: "Selecione pelo menos um pedido" },
        { status: 400 }
      )
    }

    const result = await executeExportART(prisma, { pedidoIds })

    if (result.pedidosAtualizados === 0) {
      return NextResponse.json({
        pedidosAtualizados: 0,
        message: "Nenhum pedido processado",
        csvContent: null,
      })
    }

    return NextResponse.json({
      pedidosAtualizados: result.pedidosAtualizados,
      message: `${result.pedidosAtualizados} pedido(s) exportados com sucesso`,
      csvContent: null, // CSV desabilitado
    })
  } catch (error) {
    console.error("[EXPORT_ART_EXECUTE]", error)
    return NextResponse.json(
      { error: "Erro ao executar exportação" },
      { status: 500 }
    )
  }
}

