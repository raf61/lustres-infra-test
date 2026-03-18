import { IConversationRepository } from "../domain/repositories/conversation-repository"
import { IClientChatContactRepository } from "../domain/repositories/client-chat-contact-repository"

export type UnassociateClientFromConversationInput = {
  conversationId: string
  clientId: number
}

export type UnassociateClientFromConversationResult = {
  conversationId: string
  clientId: number
  deleted: number
}

export class UnassociateClientFromConversationUseCase {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly clientChatContactRepository: IClientChatContactRepository
  ) {}

  async execute(
    input: UnassociateClientFromConversationInput
  ): Promise<UnassociateClientFromConversationResult> {
    const conversation = await this.conversationRepository.findById(input.conversationId)
    if (!conversation) {
      throw new Error("CONVERSATION_NOT_FOUND")
    }

    const deleted = await this.clientChatContactRepository.removeLink(conversation.contactId, input.clientId)

    return {
      conversationId: input.conversationId,
      clientId: input.clientId,
      deleted,
    }
  }
}

