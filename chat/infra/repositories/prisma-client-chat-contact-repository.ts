import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { IClientChatContactRepository } from '../../domain/repositories/client-chat-contact-repository';

export class PrismaClientChatContactRepository implements IClientChatContactRepository {
  async findContactIdsByClientId(clientId: number): Promise<string[]> {
    const rows = await prisma.clientChatContact.findMany({
      where: { clientId },
      select: { contactId: true },
    });
    return rows.map((row) => row.contactId);
  }

  async findContactIdsByClientIds(clientIds: number[]): Promise<Record<number, string[]>> {
    if (clientIds.length === 0) return {};

    const rows = await prisma.clientChatContact.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, contactId: true },
    });

    const map: Record<number, string[]> = {};
    for (const row of rows) {
      if (!map[row.clientId]) {
        map[row.clientId] = [];
      }
      map[row.clientId].push(row.contactId);
    }
    return map;
  }

  async findClientIdsByContactId(contactId: string): Promise<number[]> {
    const rows = await prisma.clientChatContact.findMany({
      where: { contactId },
      select: { clientId: true },
    });
    return rows.map((row) => row.clientId);
  }

  async removeLink(contactId: string, clientId: number): Promise<number> {
    const result = await prisma.clientChatContact.deleteMany({
      where: {
        contactId,
        clientId,
      },
    })
    return result.count
  }

  async ensureLink(contactId: string, clientId: number): Promise<void> {
    const existing = await prisma.clientChatContact.findFirst({
      where: {
        contactId,
        clientId,
      },
      select: { id: true },
    });

    if (existing) return;

    try {
      await prisma.clientChatContact.create({
        data: {
          contactId,
          clientId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        Array.isArray(error.meta?.target) &&
        error.meta?.target.includes('id')
      ) {
        await prisma.$executeRaw`
          SELECT setval(
            pg_get_serial_sequence('client_chat_contacts', 'id'),
            (SELECT COALESCE(MAX(id), 0) FROM "client_chat_contacts") + 1,
            false
          )
        `;
        await prisma.clientChatContact.create({
          data: {
            contactId,
            clientId,
          },
        });
        return;
      }
      throw error;
    }
  }
}

