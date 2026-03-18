import { IConversationRepository } from '../domain/repositories/conversation-repository';
import { IClientChatContactRepository } from '../domain/repositories/client-chat-contact-repository';

export type GetConversationClientsInput = {
  conversationId: string;
};

export type GetConversationClientsOutput = {
  clientIds: number[];
};

/**
 * UseCase: obter clientIds associados ao contato da conversa.
 */
export class GetConversationClientsUseCase {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly clientChatContactRepository: IClientChatContactRepository
  ) {}

  async execute(input: GetConversationClientsInput): Promise<GetConversationClientsOutput> {
    const conversation = await this.conversationRepository.findById(input.conversationId);
    if (!conversation) {
      throw new Error('CONVERSATION_NOT_FOUND');
    }

    const clientIds = await this.clientChatContactRepository.findClientIdsByContactId(
      conversation.contactId
    );

    return { clientIds };
  }
}

