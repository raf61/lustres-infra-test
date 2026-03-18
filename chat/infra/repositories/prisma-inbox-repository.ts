import { prisma } from '../../../lib/prisma';
import { IInboxRepository, InboxWithCount } from '../../domain/repositories/inbox-repository';
import { Inbox } from '../../domain/inbox';

export class PrismaInboxRepository implements IInboxRepository {
  async findByPhoneNumberId(phoneNumberId: string): Promise<Inbox | null> {
    const record = await prisma.chatInbox.findUnique({
      where: { phoneNumberId },
    });
    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findById(id: string): Promise<Inbox | null> {
    const record = await prisma.chatInbox.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.mapToDomain(record);
  }

  async create(inbox: Omit<Inbox, 'id'>): Promise<Inbox> {
    const record = await prisma.chatInbox.create({
      data: {
        name: inbox.name,
        provider: inbox.provider,
        phoneNumberId: inbox.phoneNumberId,
        displayPhoneNumber: inbox.displayPhoneNumber,
        settings: inbox.settings,
      },
    });
    return this.mapToDomain(record);
  }

  async findAllWithOpenCount(): Promise<InboxWithCount[]> {
    const records = await prisma.chatInbox.findMany({
      select: {
        id: true,
        name: true,
        provider: true,
        phoneNumberId: true,
        displayPhoneNumber: true,
        settings: true,
        messageTemplates: true,
        messageTemplatesLastUpdated: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            conversations: {
              where: { status: 'open' },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return records.map((record) => ({
      ...this.mapToDomain(record),
      openConversationsCount: record._count.conversations,
    }));
  }

  /**
   * Atualiza os templates de uma inbox (igual ao Chatwoot)
   */
  async updateTemplates(id: string, templates: any[], updatedAt: Date): Promise<void> {
    await prisma.chatInbox.update({
      where: { id },
      data: {
        messageTemplates: templates,
        messageTemplatesLastUpdated: updatedAt,
      },
    });
  }

  async updateSettings(id: string, settings: Record<string, any>): Promise<void> {
    await prisma.chatInbox.update({
      where: { id },
      data: {
        settings,
      },
    });
  }

  private mapToDomain(record: any): Inbox {
    return {
      id: record.id,
      name: record.name,
      provider: record.provider,
      phoneNumberId: record.phoneNumberId || undefined,
      displayPhoneNumber: record.displayPhoneNumber || undefined,
      settings: record.settings as Record<string, any>,
      messageTemplates: record.messageTemplates as any[] || [],
      messageTemplatesLastUpdated: record.messageTemplatesLastUpdated || null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

