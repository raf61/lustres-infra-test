import { IMessageRepository, MessageRecord } from '../domain/repositories/message-repository';
import { IConversationRepository } from '../domain/repositories/conversation-repository';
import { getBroadcastSendQueue } from '../infra/queue/broadcast-send.queue';
import { CreatePendingMessageUseCase } from './create-pending-message.usecase';
import { getChatEventsQueue } from '../infra/queue/chat-events.queue';
import { getChatbotEventsQueue } from '../../chatbot/infra/queue/chatbot-events.queue';

export type SendMessageInput = {
  conversationId: string;
  assigneeId?: string; // ID do agente que está enviando
  content?: string;
  contentType?: string;  // 'text', 'template', 'image', 'video', etc.
  messageType?: 'outgoing' | 'template'; // default: 'outgoing'
  attachments?: Array<{
    fileType: string;
    fileUrl: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  }>;
  contentAttributes?: {
    inReplyTo?: string;  // ID interno da mensagem sendo respondida
    items?: Array<{
      title: string;
      value: string;
      description?: string;
    }>;
    template?: {
      name: string;
      languageCode: string;
      components: any[];
    };
    [key: string]: any;
  };
};

export type SendMessageResult = {
  message: MessageRecord;
  queued: boolean;
};

export class BroadcastSendMessageUseCase {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly conversationRepository: IConversationRepository
  ) { }

  async execute(input: SendMessageInput): Promise<SendMessageResult> {
    const { conversationId, contentAttributes } = input;
    let { messageType = 'outgoing' } = input;

    // 1. Auto-detecção de template (Igual ao comportamento anterior)
    if (contentAttributes?.template) {
      messageType = 'template';
    }

    // 2. Validar se a conversa existe
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    const inboxId = conversation.inboxId;

    // 3. Lógica da Janela de 24h (Igual ao Chatwoot MessageWindowService)
    if (messageType === 'outgoing') {
      const lastIncomingAt = await this.conversationRepository.getLastIncomingMessageTimestamp(conversationId);
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      if (!lastIncomingAt || lastIncomingAt < twentyFourHoursAgo) {
        throw new Error('OUT_OF_24H_WINDOW: Outside the 24-hour messaging window. Please use a template message.');
      }
    }

    // 4. Salvar mensagem no DB com status 'pending'
    const createPendingMessageUseCase = new CreatePendingMessageUseCase(this.messageRepository);
    const message = await createPendingMessageUseCase.execute({
      conversationId,
      assigneeId: input.assigneeId,
      content: input.content,
      contentType: input.contentType,
      messageType,
      attachments: input.attachments,
      contentAttributes: input.contentAttributes,
    });

    if (!message) {
      throw new Error('Failed to create message');
    }

    // 6. Notificar o sistema via FILA (Event-Driven / Persistent)
    const chatEventsQueue = getChatEventsQueue();
    await chatEventsQueue.add('message.created', {
      type: 'message.created',
      payload: message,
    }, {
      jobId: `msg-event-${message.id}` // Idempotência
    });

    const chatbotEventsQueue = getChatbotEventsQueue();
    await chatbotEventsQueue.add('message.created', {
      type: 'message.created',
      payload: {
        ...message,
        inboxId,
      },
    }, {
      jobId: `chatbot-msg-event-${message.id}`,
    });

    console.log(`[SendMessageUseCase] Message ${message.id} created and event queued`);

    // 7. Enfileirar para envio na fila de BROADCAST (com rate limit)
    const queue = getBroadcastSendQueue();
    await queue.add('broadcast-send', {
      messageId: message.id,
    }, {
      jobId: message.id,  // Idempotência
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,  // 5s, 10s, 20s
      },
    });

    console.log(`[BroadcastSendMessageUseCase] Message ${message.id} (${messageType}) queued for broadcast-send`);

    return {
      message,
      queued: true,
    };
  }
}
