import { IInboxRepository } from '../domain/repositories/inbox-repository';

export interface CreateInboxInput {
  name: string;
  provider: string;
  phoneNumberId: string;
  displayPhoneNumber?: string | null;
  allowedRoles?: string[];
  whatsappCloud?: {
    wabaId?: string | null;
    token?: string | null;
    apiVersion?: string | null;
  };
}

export interface CreateInboxOutput {
  id: string;
}

/**
 * UseCase: criar inbox (somente provider whatsapp_cloud).
 */
export class CreateInboxUseCase {
  constructor(private readonly inboxRepository: IInboxRepository) {}

  async execute(input: CreateInboxInput): Promise<CreateInboxOutput> {
    const name = input.name?.trim();
    const phoneNumberId = input.phoneNumberId?.trim();
    const provider = (input.provider || '').trim();

    const wabaId = input.whatsappCloud?.wabaId?.trim();
    if (!name || !phoneNumberId || !wabaId) {
      throw new Error('INVALID_INPUT');
    }
    if (provider !== 'whatsapp_cloud') {
      throw new Error('UNSUPPORTED_PROVIDER');
    }

    const settings: Record<string, any> = {};
    const allowedRoles = Array.isArray(input.allowedRoles) ? input.allowedRoles : [];
    if (allowedRoles.length > 0) {
      settings.allowedRoles = allowedRoles;
    }

    settings.whatsapp_cloud = {
      wabaId,
    };

    const inbox = await this.inboxRepository.create({
      name,
      provider,
      phoneNumberId,
      displayPhoneNumber: input.displayPhoneNumber || undefined,
      settings,
    });

    return { id: inbox.id };
  }
}

