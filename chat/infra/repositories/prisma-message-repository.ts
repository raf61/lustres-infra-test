import { prisma } from '../../../lib/prisma';
import {
  IMessageRepository,
  CreateMessageData,
  MessageRecord,
  MessageFilters,
  MessageListData,
  MessageWithRelations,
} from '../../domain/repositories/message-repository';

export class PrismaMessageRepository implements IMessageRepository {

  async create(data: CreateMessageData): Promise<MessageRecord | null> {
    try {
      const record = await prisma.chatMessage.create({
        data: {
          conversationId: data.conversationId,
          providerMessageId: data.providerMessageId,
          messageType: data.messageType,
          contentType: data.contentType,
          content: data.content,
          status: data.status,
          timestamp: data.timestamp,
          contentAttributes: data.contentAttributes || {},
          additionalAttributes: data.additionalAttributes || {},
          attachments: data.attachments ? {
            create: data.attachments
          } : undefined
        },
        include: {
          attachments: true,
        },
      });

      return this.mapToRecord(record);
    } catch (error: any) {
      // P2002 = Unique constraint failed (mensagem duplicada)
      if (error.code === 'P2002') {
        console.log(`[MessageRepository] Duplicate message ignored: ${data.providerMessageId}`);
        return null;
      }
      throw error;
    }
  }

  async findById(id: string): Promise<MessageRecord | null> {
    const record = await prisma.chatMessage.findUnique({
      where: { id },
      include: {
        attachments: true,
        conversation: {
          include: {
            contact: {
              include: {
                inboxes: true, // Para pegar o sourceId do ContactInbox
              },
            },
            inbox: true,
          },
        },
      },
    });

    if (!record) return null;
    return this.mapToRecordWithRelations(record);
  }

  async findByProviderMessageId(providerMessageId: string): Promise<MessageRecord | null> {
    const record = await prisma.chatMessage.findUnique({
      where: { providerMessageId },
      include: {
        attachments: true,
      },
    });

    if (!record) return null;
    return this.mapToRecord(record);
  }

  /**
   * Atualiza status de mensagem (via webhook do provedor)
   * Retorna dados necessários para broadcast incluindo conversationId e inboxId
   */
  async updateStatus(providerMessageId: string, status: string, externalError?: string): Promise<MessageRecord | null> {
    try {
      const record = await prisma.chatMessage.update({
        where: { providerMessageId },
        data: {
          status,
          ...(externalError ? { externalError } : {}),
        },
        include: {
          attachments: true,
          conversation: {
            select: {
              id: true,
              inboxId: true,
              contactId: true,
            },
          },
        },
      });

      // Mapear incluindo dados da conversa para o broadcast
      const mapped = this.mapToRecord(record);
      if (record.conversation) {
        mapped.conversationId = record.conversation.id;
        mapped.contactId = record.conversation.contactId;
        // @ts-ignore - Adicionando inboxId para o broadcast
        mapped.inboxId = record.conversation.inboxId;
      }
      return mapped;
    } catch (error: any) {
      // P2025 = Record not found (mensagem ainda não existe ou é de outro sistema)
      if (error.code === 'P2025') {
        console.log(`[MessageRepository] Message not found for status update: ${providerMessageId}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Busca o status atual de uma mensagem pelo providerMessageId
   */
  async getStatus(providerMessageId: string): Promise<string | null> {
    const record = await prisma.chatMessage.findUnique({
      where: { providerMessageId },
      select: { status: true },
    });
    return record?.status || null;
  }

  async getStatusesByProviderIds(providerIds: string[]): Promise<Map<string, string>> {
    const records = await prisma.chatMessage.findMany({
      where: { providerMessageId: { in: providerIds } },
      select: { providerMessageId: true, status: true }
    });

    const map = new Map<string, string>();
    for (const r of records) {
      if (r.providerMessageId) {
        map.set(r.providerMessageId, r.status);
      }
    }
    return map;
  }

  async updateAfterSend(id: string, data: { providerMessageId: string; status: string }): Promise<MessageRecord> {
    const record = await prisma.chatMessage.update({
      where: { id },
      data: {
        providerMessageId: data.providerMessageId,
        status: data.status,
      },
      include: {
        attachments: true,
        conversation: {
          select: {
            id: true,
            inboxId: true,
          },
        },
      },
    });

    // Mapear incluindo inboxId para o broadcast
    const mapped = this.mapToRecord(record);
    if (record.conversation) {
      mapped.conversationId = record.conversation.id;
      // @ts-ignore - Adicionando inboxId para o broadcast
      mapped.inboxId = record.conversation.inboxId;
    }
    return mapped;
  }

  async markAsFailed(id: string, externalError: string): Promise<MessageRecord> {
    const record = await prisma.chatMessage.update({
      where: { id },
      data: {
        status: 'failed',
        externalError,
      },
      include: {
        attachments: true,
        conversation: {
          select: {
            id: true,
            inboxId: true,
          },
        },
      },
    });

    // Mapear incluindo inboxId para o broadcast
    const mapped = this.mapToRecord(record);
    if (record.conversation) {
      mapped.conversationId = record.conversation.id;
      // @ts-ignore - Adicionando inboxId para o broadcast
      mapped.inboxId = record.conversation.inboxId;
    }
    return mapped;
  }

  /**
   * Lista mensagens de uma conversa com paginação por cursor (createdAt).
   * Retorna dados BRUTOS - regras de negócio ficam no UseCase.
   */
  async findByConversation(conversationId: string, filters: MessageFilters): Promise<MessageListData> {
    const { before, after, limit = 20 } = filters;

    // ─────────────────────────────────────────────────────────────────────────
    // MONTAR WHERE CLAUSE
    // ─────────────────────────────────────────────────────────────────────────
    const where: any = { conversationId };

    if (before) {
      where.createdAt = { lt: before };
    } else if (after) {
      where.createdAt = { gt: after };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BUSCAR MENSAGENS
    // ─────────────────────────────────────────────────────────────────────────
    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // +1 para saber se tem mais
      include: {
        attachments: true,
        conversation: {
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Verificar se tem mais mensagens
    const hasMore = messages.length > limit;
    const slicedMessages = hasMore ? messages.slice(0, limit) : messages;

    // Inverter para ordem cronológica (mais antigas primeiro)
    const orderedMessages = slicedMessages.reverse();

    // ─────────────────────────────────────────────────────────────────────────
    // MAPEAR RESULTADO (DADOS BRUTOS)
    // ─────────────────────────────────────────────────────────────────────────
    const mappedMessages: MessageWithRelations[] = orderedMessages.map((msg: any) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      providerMessageId: msg.providerMessageId,
      messageType: msg.messageType,
      contentType: msg.contentType,
      content: msg.content,
      status: msg.status,
      externalError: msg.externalError,
      timestamp: msg.timestamp,
      contentAttributes: msg.contentAttributes,
      additionalAttributes: msg.additionalAttributes,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      // InboxId para o front saber de qual canal é
      inboxId: msg.conversation?.inboxId,
      attachments: msg.attachments?.map((att: any) => ({
        id: att.id,
        fileType: att.fileType,
        mediaId: att.mediaId,
        fileUrl: att.fileUrl,
        externalUrl: att.externalUrl,
        fileName: att.fileName,
        fileSize: att.fileSize,
        mimeType: att.mimeType,
      })),
      // Dados brutos do contato (para o UseCase decidir como usar)
      contact: msg.conversation?.contact ? {
        id: msg.conversation.contact.id,
        name: msg.conversation.contact.name,
        avatarUrl: msg.conversation.contact.avatarUrl,
      } : null,
    }));

    return {
      messages: mappedMessages,
      hasMore,
      oldestCreatedAt: orderedMessages.length > 0 ? orderedMessages[0].createdAt : undefined,
      newestCreatedAt: orderedMessages.length > 0 ? orderedMessages[orderedMessages.length - 1].createdAt : undefined,
    };
  }

  // Helpers para mapear registros
  private mapToRecord(record: any): MessageRecord {
    return {
      id: record.id,
      conversationId: record.conversationId,
      providerMessageId: record.providerMessageId,
      messageType: record.messageType,
      contentType: record.contentType,
      content: record.content,
      status: record.status,
      externalError: record.externalError,
      timestamp: record.timestamp,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      contentAttributes: record.contentAttributes,
      additionalAttributes: record.additionalAttributes,
      attachments: record.attachments?.map((att: any) => ({
        id: att.id,
        fileType: att.fileType,
        mediaId: att.mediaId,
        fileUrl: att.fileUrl,
        externalUrl: att.externalUrl,
        fileName: att.fileName,
        fileSize: att.fileSize,
        mimeType: att.mimeType,
      })),
    };
  }

  private mapToRecordWithRelations(record: any): MessageRecord {
    // Extrair sourceId do ContactInbox correspondente a esta inbox
    const contactInbox = record.conversation?.contact?.inboxes?.find(
      (ci: any) => ci.inboxId === record.conversation.inboxId
    );
    const sourceId = contactInbox?.sourceId || '';

    return {
      ...this.mapToRecord(record),
      conversation: record.conversation ? {
        id: record.conversation.id,
        inboxId: record.conversation.inboxId,
        sourceId, // O identificador para enviar neste canal específico
        inbox: {
          phoneNumberId: record.conversation.inbox.phoneNumberId,
          settings: record.conversation.inbox.settings,
        },
      } : undefined,
    };
  }
}
