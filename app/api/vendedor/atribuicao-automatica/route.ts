/**
 * API para Atribuição Automática de Clientes ao Dashboard
 * 
 * GET  - Preview: mostra o que vai acontecer na atribuição
 * POST - Execute: aplica a atribuição automática
 * 
 * Esta rota NÃO remove clientes do dashboard, apenas adiciona.
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { previewAtribuicao, executarAtribuicao } from "@/domain/client/vendor-auto-attribution"

/**
 * GET - Preview da atribuição
 * 
 * Retorna uma prévia do que acontecerá quando a atribuição for executada,
 * sem aplicar nenhuma alteração.
 */
export async function GET() {
  try {
    const preview = await previewAtribuicao(prisma)
    
    return NextResponse.json({
      success: true,
      ...preview,
    })
  } catch (error) {
    console.error("[vendedor/atribuicao-automatica][GET] Erro:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao gerar preview da atribuição",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Executar atribuição automática
 * 
 * Aplica a atribuição, tornando clientes visíveis no dashboard
 * dos vendedores conforme as regras de categoria e janela de aparição.
 */
export async function POST() {
  try {
    const result = await executarAtribuicao(prisma)
    
    if (!result.success) {
      return NextResponse.json(
        {
          ...result,
          error: "Atribuição concluída com erros",
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("[vendedor/atribuicao-automatica][POST] Erro:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao executar atribuição automática",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
