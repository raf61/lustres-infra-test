import { NextResponse } from "next/server"
import { getLoggedUserId } from "@/lib/vendor-dashboard"
import { PrismaConversationRepository } from "@/chat/infra/repositories/prisma-conversation-repository"
import { BulkReturnToResearchUseCase } from "@/chat/application/bulk-return-to-research.usecase"

// Instanciar dependências
const conversationRepository = new PrismaConversationRepository()
const bulkReturnToResearchUseCase = new BulkReturnToResearchUseCase(conversationRepository)

export async function POST(request: Request) {
    try {
        // 1. Validar usuário
        const currentUserId = await getLoggedUserId()
        if (!currentUserId) {
            return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
        }

        // 2. Validar input
        const { clientIds } = (await request.json()) as { clientIds?: number[] }
        if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
            return NextResponse.json({ error: "clientIds é obrigatório e deve ser um array" }, { status: 400 })
        }

        // 3. Executar o UseCase bulk
        const result = await bulkReturnToResearchUseCase.execute({
            clientIds,
            userId: currentUserId,
            reason: "Retornado para pesquisa em massa pelo vendedor via Dashboard"
        })

        return NextResponse.json({
            success: true,
            data: result,
            message: `${result.success} clientes retornados para pesquisa com sucesso. ${result.errors.length} falhas.`
        })
    } catch (error: any) {
        console.error("[vendedor/clients/bulk-retornar-pesquisa][POST]", error)
        return NextResponse.json(
            { error: error.message || "Erro ao retornar clientes para pesquisa" },
            { status: 500 }
        )
    }
}
