import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { processarPerda, validarDataUltimaManutencao, type LossActionType } from "@/domain/client/loss-rules"

/**
 * POST /api/vendedor/clients/[id]/perda
 * 
 * Processa a ação de "Perda" de um cliente.
 * 
 * Body:
 * - actionType: "WITH_DATE" | "WITHOUT_DATE"
 * - ultimaManutencao?: string (ISO date) - apenas quando actionType === "WITH_DATE"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const clientId = parseInt(id, 10)

    if (isNaN(clientId)) {
      return NextResponse.json(
        { error: "ID do cliente inválido" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const actionType = body.actionType as LossActionType

    if (!actionType || !["WITH_DATE", "WITHOUT_DATE"].includes(actionType)) {
      return NextResponse.json(
        { error: "actionType inválido. Use 'WITH_DATE' ou 'WITHOUT_DATE'" },
        { status: 400 }
      )
    }

    // Validar data se fornecida
    let ultimaManutencao: Date | null = null
    if (actionType === "WITH_DATE" && body.ultimaManutencao) {
      ultimaManutencao = new Date(body.ultimaManutencao)
      
      if (isNaN(ultimaManutencao.getTime())) {
        return NextResponse.json(
          { error: "Data de última manutenção inválida" },
          { status: 400 }
        )
      }

      const validacao = validarDataUltimaManutencao(ultimaManutencao)
      if (!validacao.valid) {
        return NextResponse.json(
          { error: validacao.message },
          { status: 400 }
        )
      }
    }

    // Processar a perda usando o use case centralizado
    const result = await processarPerda(prisma, {
      clientId,
      actionType,
      ultimaManutencao,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[POST /api/vendedor/clients/[id]/perda] Erro:", error)
    return NextResponse.json(
      { error: "Erro interno ao processar perda" },
      { status: 500 }
    )
  }
}

