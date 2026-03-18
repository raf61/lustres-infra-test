import { IInboxRepository } from '../domain/repositories/inbox-repository';
import { IInboxAccessPolicy, InboxAccessContext } from '../domain/policies/inbox-access-policy';

export interface InboxListItem {
  id: string;
  name: string;
  provider: string;
  phoneNumber: string | null;
  openConversationsCount: number;
  createdAt: Date | null;
}

export interface ListInboxesForUserInput {
  userId: string;
  role?: string | null;
}

export interface ListInboxesForUserOutput {
  inboxes: InboxListItem[];
}

/**
 * UseCase: Listar inboxes disponíveis para um usuário.
 * Centraliza futura autorização por inbox (policy).
 */
export class ListInboxesForUserUseCase {
  constructor(
    private readonly inboxRepository: IInboxRepository,
    private readonly accessPolicy: IInboxAccessPolicy
  ) {}

  async execute(input: ListInboxesForUserInput): Promise<ListInboxesForUserOutput> {
    const context: InboxAccessContext = {
      userId: input.userId,
      role: input.role ?? null,
    };

    const inboxes = await this.inboxRepository.findAllWithOpenCount();
    const allowed = await this.accessPolicy.filter(inboxes, context);

    return {
      inboxes: allowed
        .slice()
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
        .map((inbox) => ({
          id: inbox.id,
          name: inbox.name,
          provider: inbox.provider,
          phoneNumber: inbox.displayPhoneNumber ?? null,
          openConversationsCount: inbox.openConversationsCount,
          createdAt: inbox.createdAt ?? null,
        })),
    };
  }
}

