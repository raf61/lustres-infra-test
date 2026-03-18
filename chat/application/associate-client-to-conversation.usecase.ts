import { IClientRepository } from '../domain/repositories/client-repository';
import { IClientChatContactRepository } from '../domain/repositories/client-chat-contact-repository';
import { IConversationRepository } from '../domain/repositories/conversation-repository';

export type AssociateClientToConversationInput = {
  conversationId: string;
  cnpj?: string;
  clientId?: number;
};

export type AssociateClientToConversationResult = {
  conversationId: string;
  clientId: number;
};

export class AssociateClientToConversationUseCase {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly clientRepository: IClientRepository,
    private readonly clientChatContactRepository: IClientChatContactRepository
  ) { }

  async execute(
    input: AssociateClientToConversationInput
  ): Promise<AssociateClientToConversationResult> {
    const conversation = await this.conversationRepository.findById(input.conversationId);
    if (!conversation) {
      throw new Error('CONVERSATION_NOT_FOUND');
    }

    let client;
    if (input.clientId) {
      client = await this.clientRepository.findById(input.clientId);
    } else if (input.cnpj) {
      const normalizedCnpj = this.normalizeCnpj(input.cnpj);
      if (!normalizedCnpj) {
        throw new Error('INVALID_CNPJ');
      }
      client = await this.clientRepository.findByCnpj(normalizedCnpj);
    }

    if (!client) {
      throw new Error('CLIENT_NOT_FOUND');
    }

    await this.clientChatContactRepository.ensureLink(conversation.contactId, client.id);

    return {
      conversationId: conversation.id,
      clientId: client.id,
    };
  }

  private normalizeCnpj(value: string): string | null {
    const digits = value.trim().replace(/\D/g, '');
    if (digits.length !== 14) return null;
    return digits;
  }
}

