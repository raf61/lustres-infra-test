import { IContactRepository } from '../domain/repositories/contact-repository';
import { IContactInboxRepository } from '../domain/repositories/contact-inbox-repository';
import { IConversationRepository } from '../domain/repositories/conversation-repository';
import { IInboxRepository } from '../domain/repositories/inbox-repository';
import { IBroadcaster } from '../domain/events/broadcaster';
import { Conversation } from '../domain/conversation';
import { SendMessageUseCase, SendMessageInput, SendMessageResult } from './send-message.usecase';
import { standardizeWaId } from './utils/standardize-wa-id';

export type CreateConversationInput = {
  inboxId: string;
  phoneNumber: string;       // Número do cliente (waId)
  contactName?: string;      // Nome opcional
  assigneeId?: string;       // ID do agente (para auto-atribuição)
  message?: {
    content?: string;
    contentType?: string;
    messageType?: 'outgoing' | 'template';
    attachments?: SendMessageInput['attachments'];
    contentAttributes?: SendMessageInput['contentAttributes'];
  };
};

export type CreateConversationResult = {
  conversation: Conversation;
  isNew: boolean;
  messageSent?: SendMessageResult;
};

/**
 * Cria ou encontra uma conversa para envio proativo.
 * IGUAL AO CHATWOOT: ConversationsController#create + ContactInboxBuilder
 */
export class CreateConversationUseCase {
  constructor(
    private readonly contactRepository: IContactRepository,
    private readonly contactInboxRepository: IContactInboxRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly inboxRepository: IInboxRepository,
    private readonly sendMessageUseCase: SendMessageUseCase,
    private readonly broadcaster: IBroadcaster
  ) { }

  async execute(input: CreateConversationInput): Promise<CreateConversationResult> {
    const { inboxId, phoneNumber: rawPhoneNumber, contactName, assigneeId, message } = input;

    // 0. Padronização Centralizada (Blindagem contra variações de 9-dígito)
    const phoneNumber = standardizeWaId(rawPhoneNumber);

    // 1. Validar que a inbox existe (pré-condição de negócio)
    const inbox = await this.inboxRepository.findById(inboxId);
    if (!inbox) {
      throw new Error(`INBOX_NOT_FOUND: Inbox ${inboxId} does not exist`);
    }

    // 2. Reusar contato existente (findByWaId já busca variações BR)
    const contact = await this.contactRepository.ensureContact(phoneNumber, contactName);
    const contactIdToUse = contact.id;
    const sourceIdToUse = phoneNumber; // Usamos o waId padronizado como sourceId

    // 3. Garantir ContactInbox (vínculo)
    await this.contactInboxRepository.ensureContactInbox(contactIdToUse, inboxId, sourceIdToUse);

    // 4. Garantir conversa (retorna { conversation, isNew })
    const { conversation: conv, isNew } = await this.conversationRepository.ensureConversation(contactIdToUse, inboxId);
    let conversation = conv;

    // Se criou conversa nova, broadcast direto (não precisa de lógica adicional)
    if (isNew) {
      await this.broadcaster.broadcast({
        type: 'conversation.created',
        payload: {
          id: conversation.id,
          contactId: conversation.contactId,
          inboxId: conversation.inboxId,
          status: conversation.status,
        },
      });
      console.log(`[CreateConversation] New conversation ${conversation.id} created, broadcast sent`);
    } else {
      console.log(`[CreateConversation] Found existing conversation ${conversation.id} (status: ${conversation.status})`);
    }

    // 4. Atribuir assignee se fornecido e a conversa não tem assignee
    if (assigneeId && !conversation.assigneeId) {
      conversation = await this.conversationRepository.updateAssignee(conversation.id, assigneeId);
      console.log(`[CreateConversation] Assigned ${assigneeId} to conversation ${conversation.id}`);
    }

    // 5. Se tiver mensagem, usa o SendMessageUseCase centralizado
    let messageSent: SendMessageResult | undefined;
    if (message) {
      messageSent = await this.sendMessageUseCase.execute({
        conversationId: conversation.id,
        assigneeId: assigneeId,
        content: message.content,
        contentType: message.contentType,
        messageType: message.messageType,
        attachments: message.attachments,
        contentAttributes: message.contentAttributes,
      });
      console.log(`[CreateConversation] Message queued: ${messageSent.message.id}`);
    }

    return {
      conversation,
      isNew,
      messageSent,
    };
  }
}
