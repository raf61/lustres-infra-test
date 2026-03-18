import { IConversationRepository } from '../domain/repositories/conversation-repository';
import { IBroadcaster } from '../domain/events/broadcaster';
import { Conversation } from '../domain/conversation';
import { getChatbotEventsQueue } from '../../chatbot/infra/queue/chatbot-events.queue';

// ============================================================================
// TIPOS
// ============================================================================

export type ResolveConversationInput = {
  conversationId: string;
};

export type ResolveConversationResult = {
  conversation: Conversation;
  wasAlreadyResolved: boolean;
};

// ============================================================================
// ERROS DE NEGÓCIO
// ============================================================================

export class ConversationNotFoundError extends Error {
  constructor(conversationId: string) {
    super(`CONVERSATION_NOT_FOUND: Conversation ${conversationId} does not exist`);
    this.name = 'ConversationNotFoundError';
  }
}

// ============================================================================
// USE CASE
// ============================================================================

/**
 * Resolve (fecha) uma conversa.
 * 
 * Comportamento igual ao Chatwoot:
 * - Muda status para 'resolved'
 * - Limpa waitingSince (feito no repositório)
 * - Mantém assigneeId
 * - Broadcast direto para real-time
 */
export class ResolveConversationUseCase {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly broadcaster: IBroadcaster
  ) { }

  async execute(input: ResolveConversationInput): Promise<ResolveConversationResult> {
    const { conversationId } = input;

    // 1. Buscar conversa
    const conversation = await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }

    // 2. Verificar se já está resolvida (idempotente)
    if (conversation.status === 'resolved') {
      return {
        conversation,
        wasAlreadyResolved: true,
      };
    }

    // 3. Resolver (o repositório já limpa waitingSince)
    const resolvedConversation = await this.conversationRepository.updateStatus(
      conversationId,
      'resolved'
    );

    console.log(`[ResolveConversation] Conversation ${conversationId} resolved`);

    // 4. Broadcast direto (não precisa de lógica adicional)
    await this.broadcaster.broadcast({
      type: 'conversation.updated',
      payload: {
        conversationId,
        inboxId: resolvedConversation.inboxId,
        status: 'resolved',
        waitingSince: null,
        lastActivityAt: resolvedConversation.lastActivityAt,
        assigneeId: resolvedConversation.assigneeId,
      },
    });

    // 5. Notificar chatbot para encerrar sessão ativa
    const chatbotEventsQueue = getChatbotEventsQueue();
    await chatbotEventsQueue.add('conversation.status_changed', {
      type: 'conversation.status_changed',
      payload: {
        conversationId,
        status: 'resolved',
        inboxId: resolvedConversation.inboxId,
      },
    });

    return {
      conversation: resolvedConversation,
      wasAlreadyResolved: false,
    };
  }
}
