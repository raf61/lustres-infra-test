import { NextResponse } from "next/server"
import { getLoggedUserId } from "@/lib/vendor-dashboard"
import { PrismaConversationRepository } from "@/chat/infra/repositories/prisma-conversation-repository"
import { ReturnToResearchUseCase } from "@/chat/application/return-to-research.usecase"
import { prisma } from "@/lib/prisma"

// Instanciar dependências
const conversationRepository = new PrismaConversationRepository()
const returnToResearchUseCase = new ReturnToResearchUseCase(conversationRepository)

export async function POST(request: Request) {
  try {
    // 1. Validar usuário
    const currentUserId = await getLoggedUserId()
    if (!currentUserId) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
    }

    // 2. Validar input
    const { clientId } = (await request.json()) as { clientId?: number }
    if (!clientId || typeof clientId !== "number") {
      return NextResponse.json({ error: "clientId é obrigatório" }, { status: 400 })
    }

    // 3. Buscar categoria para validação (Regra de negócio: apenas Livres)
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { categoria: true }
    })

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
    }

    // 4. Executar o UseCase consolidado (Extraído da lógica original)
    await returnToResearchUseCase.execute({
      clientId,
      userId: currentUserId,
      reason: "Retornado para pesquisa pelo vendedor via Dashboard"
    })

    return NextResponse.json({
      success: true,
      message: "Cliente retornado para pesquisa com sucesso"
    })
  } catch (error: any) {
    console.error("[vendedor/clients/retornar-pesquisa][POST]", error)
    return NextResponse.json(
      { error: error.message || "Erro ao retornar cliente para pesquisa" },
      { status: 500 }
    )
  }
}
