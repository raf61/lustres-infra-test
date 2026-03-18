import { IClientChatContactRepository } from '../domain/repositories/client-chat-contact-repository';
import { IConversationRepository } from '../domain/repositories/conversation-repository';
import { IInboxRepository } from '../domain/repositories/inbox-repository';
import { IInboxAccessPolicy, InboxAccessContext } from '../domain/policies/inbox-access-policy';

export type FindLatestConversationForClientInput = {
  clientId: number;
  userId: string;
  role?: string | null;
};

export type FindLatestConversationForClientOutput = {
  conversationId: string;
  inboxId: string;
  lastActivityAt: Date | null;
} | null;

/**
 * UseCase: buscar conversa mais recente de um cliente respeitando acesso por inbox.
 */
export class FindLatestConversationForClientUseCase {
  constructor(
    private readonly clientChatContactRepository: IClientChatContactRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly inboxRepository: IInboxRepository,
    private readonly inboxAccessPolicy: IInboxAccessPolicy
  ) {}

  async execute(
    input: FindLatestConversationForClientInput
  ): Promise<FindLatestConversationForClientOutput> {
    const contactIds = await this.clientChatContactRepository.findContactIdsByClientId(
      input.clientId
    );

    if (contactIds.length === 0) return null;

    const inboxes = await this.inboxRepository.findAllWithOpenCount();
    const allowed = await this.inboxAccessPolicy.filter(inboxes, {
      userId: input.userId,
      role: input.role ?? null,
    } as InboxAccessContext);

    const allowedInboxIds = allowed.map((inbox) => inbox.id);
    if (allowedInboxIds.length === 0) return null;

    const conversation = await this.conversationRepository.findLatestByContactsAndInboxes(
      contactIds,
      allowedInboxIds
    );

    if (!conversation) return null;

    return {
      conversationId: conversation.id,
      inboxId: conversation.inboxId,
      lastActivityAt: conversation.lastActivityAt ?? null,
    };
  }
}

