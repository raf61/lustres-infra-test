import { prisma } from '../../../lib/prisma';
import { IContactRepository } from '../../domain/repositories/contact-repository';
import { Contact } from '../../domain/contact';
import { getBrazilianPhoneAlternatives } from '../../application/utils/brazil-phone';

export class PrismaContactRepository implements IContactRepository {
  async findByWaId(waId: string): Promise<Contact | null> {
    // 1. Tentar encontrar pelo waId exato
    let record = await prisma.chatContact.findUnique({
      where: { waId },
    });

    // 2. Se não encontrou, e for número do Brasil, tentar a variação (com/sem 9)
    if (!record && waId.startsWith('55')) {
      const alternates = getBrazilianPhoneAlternatives(waId);
      for (const alt of alternates) {
        record = await prisma.chatContact.findUnique({ where: { waId: alt } });
        if (record) break;
      }
    }

    if (!record) return null;
    return record;
  }

  async create(contact: Omit<Contact, 'id'>): Promise<Contact> {
    return await prisma.chatContact.create({
      data: {
        waId: contact.waId,
        name: contact.name,
        avatarUrl: contact.avatarUrl,
      },
    });
  }

  async update(id: string, contact: Partial<Contact>): Promise<Contact> {
    return await prisma.chatContact.update({
      where: { id },
      data: {
        waId: contact.waId, // Permitir atualização de waId (usado no status update)
        name: contact.name,
        avatarUrl: contact.avatarUrl,
      },
    });
  }

  async ensureContact(waId: string, name?: string): Promise<Contact> {
    // 1. Tentar encontrar pelo waId exato
    let existing = await prisma.chatContact.findUnique({ where: { waId } });

    // 2. Se não encontrou, e for número do Brasil, tentar a variação (com/sem 9)
    if (!existing && waId.startsWith('55')) {
      const alternates = getBrazilianPhoneAlternatives(waId);
      for (const alt of alternates) {
        existing = await prisma.chatContact.findUnique({ where: { waId: alt } });
        if (existing) {
          console.log(`[ContactRepository] Found existing contact via Brazilian alternate: ${alt} for requested ${waId}`);
          break;
        }
      }
    }

    if (existing) {
      /**
       * Lógica igual ao Chatwoot:
       * Só atualiza o nome se:
       * 1. O nome atual estiver vazio OU
       * 2. O nome atual for exatamente igual ao WA_ID (ou seja, ainda não foi identificado)
       */
      const isUnidentified = !existing.name || existing.name === waId || existing.name === `+${waId}`;

      if (isUnidentified && name && name !== waId) {
        return await prisma.chatContact.update({
          where: { waId },
          data: { name },
        });
      }
      return existing;
    }

    // Não existe: criar
    return await prisma.chatContact.upsert({
      where: { waId },
      update: {},
      create: {
        waId,
        name: name || waId // Se não vier nome, usa o waId como padrão inicial
      },
    });
  }
}

