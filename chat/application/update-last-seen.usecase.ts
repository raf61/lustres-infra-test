import { IConversationRepository } from '../domain/repositories/conversation-repository';
import { IBroadcaster } from '../domain/events/broadcaster';

export interface UpdateLastSeenInput {
  conversationId: string;
}

export class ConversationNotFoundError extends Error {
  constructor(id: string) {
    super(`Conversation ${id} not found`);
    this.name = 'ConversationNotFoundError';
  }
}

/**
 * UseCase: Atualiza agentLastSeenAt para marcar que o agente viu a conversa.
 * 
 * Igual ao Chatwoot: update_last_seen
 * - Atualiza agentLastSeenAt = now()
 * - O unreadCount é calculado dinamicamente: messages.where(createdAt > agentLastSeenAt)
 * - Faz broadcast para atualizar outros clients em realtime
 */
export class UpdateLastSeenUseCase {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly broadcaster: IBroadcaster
  ) {}

  async execute(input: UpdateLastSeenInput) {
    const { conversationId } = input;

    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }

    const now = new Date();

    // Atualiza o timestamp de última visualização
    await this.conversationRepository.updateLastSeen(conversationId, now);

    // Recalcula unreadCount (agora será 0 ou próximo de 0)
    const unreadCount = await this.conversationRepository.countUnreadMessages(conversationId, now);

    // Broadcast para atualizar outros clients (ex: dashboard vendedor)
    await this.broadcaster.broadcast({
      type: 'conversation.updated',
      payload: {
        conversationId,
        inboxId: conversation.inboxId,
        status: conversation.status,
        waitingSince: conversation.waitingSince,
        lastActivityAt: conversation.lastActivityAt,
        agentLastSeenAt: now,
        unreadCount,
      },
    });

    return { success: true };
  }
}
