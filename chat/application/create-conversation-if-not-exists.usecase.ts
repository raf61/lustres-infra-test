import { IContactRepository } from '../domain/repositories/contact-repository';
import { IContactInboxRepository } from '../domain/repositories/contact-inbox-repository';
import { IConversationRepository } from '../domain/repositories/conversation-repository';
import { IInboxRepository } from '../domain/repositories/inbox-repository';
import { CreateConversationUseCase } from './create-conversation.usecase';
import { standardizeWaId } from './utils/standardize-wa-id';

// ============================================================================
// TIPOS DE ENTRADA/SAÍDA
// ============================================================================

export type CreateConversationIfNotExistsInput = {
  inboxId: string;
  phoneNumber: string;
  contactName?: string;
  assigneeId?: string;
};

export type CreateConversationIfNotExistsOutput = {
  created: boolean;
  exists: boolean;
  conversationId?: string;
};

// ============================================================================
// USE CASE
// ============================================================================

/**
 * Cria uma nova conversa somente se o número ainda não existir na inbox.
 * Se já existir, NÃO cria e retorna a conversa existente (se encontrada).
 */
export class CreateConversationIfNotExistsUseCase {
  constructor(
    private readonly contactRepository: IContactRepository,
    private readonly contactInboxRepository: IContactInboxRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly inboxRepository: IInboxRepository,
    private readonly createConversationUseCase: CreateConversationUseCase
  ) { }

  async execute(
    input: CreateConversationIfNotExistsInput
  ): Promise<CreateConversationIfNotExistsOutput> {
    const { inboxId, phoneNumber, contactName, assigneeId } = input;

    // 1. Padronização Robusta (Brasil + DDI)
    const waId = standardizeWaId(phoneNumber);

    // Validar inbox
    const inbox = await this.inboxRepository.findById(inboxId);
    if (!inbox) {
      throw new Error(`INBOX_NOT_FOUND: Inbox ${inboxId} does not exist`);
    }

    // 2. Verificar se o contato já existe globalmente (findByWaId já busca variações BR)
    const existingContact = await this.contactRepository.findByWaId(waId);

    if (existingContact) {
      // 2.1 Verificar se já existe conversa nessa inbox
      const existingConversation = await this.conversationRepository.findLastByContactAndInbox(
        existingContact.id,
        inboxId
      );

      if (existingConversation) {
        return {
          created: false,
          exists: true,
          conversationId: existingConversation.id,
        };
      }

      // 2.2 Se o contato existe mas não tem conversa, PRECISAMOS criar para poder enviar
      // Não basta retornar exists: true sem ID, senão o envio falha.
    }

    // 3. Não existe conversa: criar usando o use case centralizado
    // O CreateConversationUseCase também lida com variações de 9-dígito internamente
    const result = await this.createConversationUseCase.execute({
      inboxId,
      phoneNumber: waId,
      contactName,
      assigneeId,
    });

    return {
      created: true,
      exists: false,
      conversationId: result.conversation.id,
    };
  }
}

