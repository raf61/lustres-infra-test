import { CreateConversationUseCase } from './create-conversation.usecase';
import { IClientRepository } from '../domain/repositories/client-repository';
import { IClientChatContactRepository } from '../domain/repositories/client-chat-contact-repository';
import { Conversation } from '../domain/conversation';

export type CreateClientConversationInput = {
  clientId: number;
  inboxId: string;
  phoneNumber: string;
  contactName?: string | null;
  assigneeId?: string;
};

export type CreateClientConversationOutput = {
  conversation: Conversation;
  isNew: boolean;
  normalizedPhoneNumber: string;
};

const normalizePhoneNumber = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
};

/**
 * UseCase: Criar/garantir conversa para um cliente (CRM → Chat)
 * - Normaliza número
 * - Garante conversa via CreateConversationUseCase
 * - Garante vínculo Client ↔ Contact
 */
export class CreateClientConversationUseCase {
  constructor(
    private readonly createConversationUseCase: CreateConversationUseCase,
    private readonly clientRepository: IClientRepository,
    private readonly clientChatContactRepository: IClientChatContactRepository
  ) {}

  async execute(input: CreateClientConversationInput): Promise<CreateClientConversationOutput> {
    const normalizedPhoneNumber = normalizePhoneNumber(input.phoneNumber);
    if (!normalizedPhoneNumber) {
      throw new Error('INVALID_PHONE_NUMBER');
    }

    const client = await this.clientRepository.findById(input.clientId);
    if (!client) {
      throw new Error('CLIENT_NOT_FOUND');
    }

    const contactName =
      input.contactName?.trim() ||
      client.nomeSindico?.trim() ||
      client.razaoSocial;

    const result = await this.createConversationUseCase.execute({
      inboxId: input.inboxId,
      phoneNumber: normalizedPhoneNumber,
      contactName: contactName || undefined,
      assigneeId: input.assigneeId,
    });

    await this.clientChatContactRepository.ensureLink(result.conversation.contactId, client.id);

    return {
      conversation: result.conversation,
      isNew: result.isNew,
      normalizedPhoneNumber,
    };
  }
}

