import { IInboxRepository } from '../domain/repositories/inbox-repository';

export interface UpdateInboxAllowedRolesInput {
  inboxId: string;
  allowedRoles: string[];
}

export interface UpdateInboxAllowedRolesOutput {
  id: string;
  allowedRoles: string[];
}

/**
 * UseCase: Atualizar apenas allowedRoles dentro de settings.
 */
export class UpdateInboxAllowedRolesUseCase {
  constructor(private readonly inboxRepository: IInboxRepository) {}

  async execute(input: UpdateInboxAllowedRolesInput): Promise<UpdateInboxAllowedRolesOutput> {
    const inbox = await this.inboxRepository.findById(input.inboxId);
    if (!inbox) {
      throw new Error('INBOX_NOT_FOUND');
    }

    const settings = {
      ...(inbox.settings || {}),
      allowedRoles: input.allowedRoles,
    };

    await this.inboxRepository.updateSettings(input.inboxId, settings);

    return { id: inbox.id, allowedRoles: input.allowedRoles };
  }
}

