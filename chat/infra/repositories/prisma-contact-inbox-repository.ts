import { prisma } from '../../../lib/prisma';
import { IContactInboxRepository, ContactInbox } from '../../domain/repositories/contact-inbox-repository';

export class PrismaContactInboxRepository implements IContactInboxRepository {
  
  async findBySourceIdAndInbox(sourceId: string, inboxId: string): Promise<ContactInbox | null> {
    const record = await prisma.chatContactInbox.findFirst({
      where: { sourceId, inboxId },
      include: { contact: true },
    });
    
    if (!record) return null;
    
    return {
      id: record.id,
      contactId: record.contactId,
      inboxId: record.inboxId,
      sourceId: record.sourceId || '',
      contact: record.contact,
    };
  }

  async create(data: { contactId: string; inboxId: string; sourceId: string }): Promise<ContactInbox> {
    const record = await prisma.chatContactInbox.create({
      data: {
        contactId: data.contactId,
        inboxId: data.inboxId,
        sourceId: data.sourceId,
      },
    });
    
    return {
      id: record.id,
      contactId: record.contactId,
      inboxId: record.inboxId,
      sourceId: record.sourceId || '',
    };
  }

  async ensureContactInbox(contactId: string, inboxId: string, sourceId: string): Promise<ContactInbox> {
    // Tenta encontrar primeiro
    const existing = await this.findBySourceIdAndInbox(sourceId, inboxId);
    if (existing) return existing;

    // Não existe, tenta criar (com upsert para evitar race condition)
    try {
      const record = await prisma.chatContactInbox.upsert({
        where: {
          contactId_inboxId: { contactId, inboxId },
        },
        update: { sourceId }, // Se já existe o par contact+inbox, atualiza o sourceId
        create: {
          contactId,
          inboxId,
          sourceId,
        },
      });

      return {
        id: record.id,
        contactId: record.contactId,
        inboxId: record.inboxId,
        sourceId: record.sourceId || '',
      };
    } catch (error: any) {
      // Race condition: outro processo criou, buscar novamente
      const retry = await this.findBySourceIdAndInbox(sourceId, inboxId);
      if (retry) return retry;
      throw error;
    }
  }
}

