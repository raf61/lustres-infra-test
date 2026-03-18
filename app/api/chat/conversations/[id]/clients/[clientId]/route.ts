import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { UnassociateClientFromConversationUseCase } from "@/chat/application/unassociate-client-from-conversation.usecase"
import { PrismaConversationRepository } from "@/chat/infra/repositories/prisma-conversation-repository"
import { PrismaClientChatContactRepository } from "@/chat/infra/repositories/prisma-client-chat-contact-repository"

export const dynamic = "force-dynamic"

type RouteParams = {
  params: Promise<{
    id: string
    clientId: string
  }>
}

/**
 * DELETE /api/chat/conversations/:id/clients/:clientId
 * Remove vínculo ClientChatContact (clientId x conversation.contactId)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: conversationId, clientId: rawClientId } = await params
    const clientId = Number.parseInt(rawClientId, 10)
    if (!clientId || Number.isNaN(clientId)) {
      return NextResponse.json({ error: "clientId inválido" }, { status: 400 })
    }

    const useCase = new UnassociateClientFromConversationUseCase(
      new PrismaConversationRepository(),
      new PrismaClientChatContactRepository()
    )

    const result = await useCase.execute({ conversationId, clientId })

    return NextResponse.json({ success: true, deleted: result.deleted })
  } catch (error) {
    console.error("[DELETE /api/chat/conversations/:id/clients/:clientId] Error:", error)
    if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND") {
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

