import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { releaseClientsFromVendorBatch } from "@/domain/client/vendor-assignment-rules"

/**
 * API para liberar clientes de seus vendedores.
 * 
 * Esta rota é reutilizável e pode ser usada para:
 * - Liberar clientes manualmente selecionados
 * - Liberar clientes em lote após análise
 * - Limpar carteira de vendedor
 * 
 * Comportamento (centralizado em releaseClientsFromVendorBatch):
 * - Remove vendedorId
 * - Remove vendedorAlocadoEm
 * - Seta visivelDashVendedor = false
 * - Registra histórico OUTDASH (se estava no dashboard)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, reason } = body as { 
      ids: number[]
      reason?: string 
    }

    // Validação
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "IDs de clientes são obrigatórios" },
        { status: 400 }
      )
    }

    // Validar que todos os IDs são números
    const validIds = ids.filter((id) => typeof id === "number" && !isNaN(id))
    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "Nenhum ID válido fornecido" },
        { status: 400 }
      )
    }

    console.log(`[clients][liberar-vendedor][POST] Liberando ${validIds.length} clientes`)

    // Usar o use case centralizado
    const liberados = await releaseClientsFromVendorBatch(
      prisma,
      validIds,
      reason || "Liberação manual via API"
    )

    console.log(`[clients][liberar-vendedor][POST] ${liberados} clientes liberados com sucesso`)

    return NextResponse.json({
      success: true,
      released: liberados,
      message: `${liberados} cliente(s) liberado(s) com sucesso`,
    })
  } catch (error) {
    console.error("[clients][liberar-vendedor][POST] Error", error)
    return NextResponse.json(
      { error: "Erro ao liberar clientes" },
      { status: 500 }
    )
  }
}

