import { IConversationRepository } from '../domain/repositories/conversation-repository';
import { IBroadcaster } from '../domain/events/broadcaster';

export interface AssignConversationInput {
  conversationId: string;
  assigneeId: string | null;
}

export class ConversationNotFoundError extends Error {
  constructor(id: string) {
    super(`Conversation ${id} not found`);
    this.name = 'ConversationNotFoundError';
  }
}

export class AssigneeNotFoundError extends Error {
  constructor(id: string) {
    super(`Assignee ${id} not found or inactive`);
    this.name = 'AssigneeNotFoundError';
  }
}

/**
 * UseCase: Atribuir conversa a um agente
 */
export class AssignConversationUseCase {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly broadcaster: IBroadcaster
  ) {}

  async execute(input: AssignConversationInput) {
    const { conversationId, assigneeId } = input;

    // Verificar se conversa existe
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }

    // Atualizar assignee
    const updated = await this.conversationRepository.updateAssignee(conversationId, assigneeId);

    // Buscar dados completos para broadcast
    const details = await this.conversationRepository.findByIdWithRelations(conversationId);

    // Broadcast
    await this.broadcaster.broadcast({
      type: 'conversation.updated',
      payload: {
        id: updated.id,
        inboxId: updated.inboxId,
        status: updated.status,
        assigneeId: updated.assigneeId,
        contact: details?.contact,
        assignee: details?.assignee,
      },
    });

    return { conversation: updated };
  }
}

