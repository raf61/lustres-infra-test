import { IConversationRepository } from "../domain/repositories/conversation-repository";
import { Conversation } from "../domain/conversation";

export type AutoAssignConversationInput = {
  conversationId: string;
  senderId?: string | null;
};

export type AutoAssignConversationResult = {
  conversation: Conversation;
  changed: boolean;
};

/**
 * UseCase: auto-atribuir conversa ao agente que enviou mensagem.
 * Responsabilidade única: atualizar assignee com base no senderId.
 */
export class AutoAssignConversationUseCase {
  constructor(private readonly conversationRepository: IConversationRepository) {}

  async execute(input: AutoAssignConversationInput): Promise<AutoAssignConversationResult> {
    const { conversationId, senderId } = input;

    if (!senderId) {
      const existing = await this.conversationRepository.findById(conversationId);
      if (!existing) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
      return { conversation: existing, changed: false };
    }

    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    if (conversation.assigneeId === senderId) {
      return { conversation, changed: false };
    }

    const updated = await this.conversationRepository.updateAssignee(conversationId, senderId);
    return { conversation: updated, changed: true };
  }
}

