import { IInboxRepository } from '../domain/repositories/inbox-repository';

export interface InboxAllowedRolesItem {
  id: string;
  name: string;
  provider: string;
  phoneNumber: string | null;
  allowedRoles: string[];
}

export interface ListInboxesAllowedRolesOutput {
  inboxes: InboxAllowedRolesItem[];
}

/**
 * UseCase: Listar inboxes com allowedRoles (apenas para configuração).
 */
export class ListInboxesAllowedRolesUseCase {
  constructor(private readonly inboxRepository: IInboxRepository) {}

  async execute(): Promise<ListInboxesAllowedRolesOutput> {
    const inboxes = await this.inboxRepository.findAllWithOpenCount();

    return {
      inboxes: inboxes.map((inbox) => {
        const settings = (inbox.settings || {}) as { allowedRoles?: string[] };
        const allowedRoles = Array.isArray(settings.allowedRoles) ? settings.allowedRoles : [];
        return {
          id: inbox.id,
          name: inbox.name,
          provider: inbox.provider,
          phoneNumber: inbox.displayPhoneNumber ?? null,
          allowedRoles,
        };
      }),
    };
  }
}

