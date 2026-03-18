import { IInboxRepository } from '../domain/repositories/inbox-repository';

export interface InboxListItem {
  id: string;
  name: string;
  provider: string;
  phoneNumber: string | null;
  openConversationsCount: number;
}

export interface ListInboxesOutput {
  inboxes: InboxListItem[];
}

/**
 * UseCase: Listar inboxes disponíveis
 */
export class ListInboxesUseCase {
  constructor(private readonly inboxRepository: IInboxRepository) {}

  async execute(): Promise<ListInboxesOutput> {
    const inboxes = await this.inboxRepository.findAllWithOpenCount();

    return {
      inboxes: inboxes.map((inbox) => ({
        id: inbox.id,
        name: inbox.name,
        provider: inbox.provider,
        phoneNumber: inbox.displayPhoneNumber ?? null,
        openConversationsCount: inbox.openConversationsCount,
      })),
    };
  }
}

