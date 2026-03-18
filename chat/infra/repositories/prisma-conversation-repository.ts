import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import {
  IConversationRepository,
  ConversationFilters,
  ConversationListData,
  ConversationWithRelations,
  ConversationCounts,
  StatusCounts,
  ConversationLatestSummaryByContact,
} from '../../domain/repositories/conversation-repository';
import { Conversation } from '../../domain/conversation';

// Implementação Prisma do repositório de conversas
// COMPORTAMENTO: Sempre reutiliza a mesma conversa (single conversation per contact+inbox)
export class PrismaConversationRepository implements IConversationRepository {

  /**
   * Busca a ÚLTIMA conversa do contato na inbox (qualquer status).
   */
  async findLastByContactAndInbox(contactId: string, inboxId: string): Promise<Conversation | null> {
    const record = await prisma.chatConversation.findFirst({
      where: {
        contactId,
        inboxId,
        // NÃO filtra por status - pega qualquer uma
      },
      orderBy: {
        createdAt: 'desc', // A mais recente
      },
    });
    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findLatestByContactsAndInboxes(
    contactIds: string[],
    inboxIds: string[]
  ): Promise<Conversation | null> {
    if (contactIds.length === 0 || inboxIds.length === 0) return null;

    const record = await prisma.chatConversation.findFirst({
      where: {
        contactId: { in: contactIds },
        inboxId: { in: inboxIds },
      },
      orderBy: {
        lastActivityAt: 'desc',
      },
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findLatestWithRelationsByContactsAndInboxes(
    contactIds: string[],
    inboxIds: string[]
  ): Promise<ConversationWithRelations | null> {
    if (contactIds.length === 0 || inboxIds.length === 0) return null;

    const record: any = await prisma.chatConversation.findFirst({
      where: {
        contactId: { in: contactIds },
        inboxId: { in: inboxIds },
      },
      orderBy: {
        lastActivityAt: 'desc',
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            waId: true,
            avatarUrl: true,
            inboxes: {
              select: { inboxId: true, sourceId: true },
            },
            clients: {
              select: {
                client: {
                  select: {
                    id: true,
                    razaoSocial: true,
                    nomeSindico: true,
                  },
                },
              },
            },
          },
        },
        inbox: {
          select: {
            id: true,
            name: true,
            provider: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            contentType: true,
            messageType: true,
            status: true,
            createdAt: true,
          },
        },
        chatbotSessions: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: { status: true }
        }
      },
    });

    if (!record) return null;

    const lastIncomingAt = await this.getLastIncomingMessageTimestamp(record.id);

    return {
      id: record.id,
      contactId: record.contactId,
      inboxId: record.inboxId,
      status: record.status,
      assigneeId: record.assigneeId,
      waitingSince: record.waitingSince,
      lastActivityAt: record.lastActivityAt,
      agentLastSeenAt: record.agentLastSeenAt,
      chatbotStatus: (record.chatbotSessions?.[0]?.status as any) || null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      contact: {
        id: record.contact.id,
        name: record.contact.name,
        waId: record.contact.waId,
        avatarUrl: record.contact.avatarUrl,
        phoneNumber:
          record.contact.inboxes?.find((link: any) => link.inboxId === record.inboxId)?.sourceId || null,
        clients: (record.contact.clients || []).map((link: any) => ({
          id: link.client.id,
          razaoSocial: link.client.razaoSocial,
          nomeSindico: link.client.nomeSindico,
        })),
      },
      inbox: {
        id: record.inbox.id,
        name: record.inbox.name,
        channelType: record.inbox.provider || 'whatsapp_cloud',
      },
      assignee: record.assignee
        ? { id: record.assignee.id, name: record.assignee.name, email: record.assignee.email }
        : null,
      lastMessage: record.messages[0]
        ? {
          id: record.messages[0].id,
          content: record.messages[0].content,
          contentType: record.messages[0].contentType,
          messageType: record.messages[0].messageType,
          status: record.messages[0].status,
          createdAt: record.messages[0].createdAt,
        }
        : null,
      lastIncomingAt,
    };
  }

  async findLatestSummariesByContactIds(
    contactIds: string[],
    inboxIds: string[]
  ): Promise<ConversationLatestSummaryByContact[]> {
    if (contactIds.length === 0 || inboxIds.length === 0) return [];

    const rows = await prisma.$queryRaw<
      Array<{
        contactId: string;
        conversationId: string;
        inboxId: string;
        lastActivityAt: Date | null;
        waitingSince: Date | null;
        agentLastSeenAt: Date | null;
        status: string;
        unreadCount: number | null;
        lastMessageId: string | null;
        lastMessageContent: string | null;
        lastMessageContentType: string | null;
        lastMessageMessageType: string | null;
        lastMessageStatus: string | null;
        lastMessageContentAttributes: any | null;
        lastMessageCreatedAt: Date | null;
      }>
    >(Prisma.sql`
      SELECT DISTINCT ON (c."contactId")
        c."contactId" as "contactId",
        c.id as "conversationId",
        c."inboxId" as "inboxId",
        c."lastActivityAt" as "lastActivityAt",
        c."waitingSince" as "waitingSince",
        c."agentLastSeenAt" as "agentLastSeenAt",
        c.status as "status",
        COALESCE(uc.unread_count, 0) as "unreadCount",
        lm.id as "lastMessageId",
        lm.content as "lastMessageContent",
        lm."contentType" as "lastMessageContentType",
        lm."messageType" as "lastMessageMessageType",
        lm.status as "lastMessageStatus",
        lm."contentAttributes" as "lastMessageContentAttributes",
        lm."createdAt" as "lastMessageCreatedAt"
      FROM "chat_conversations" c
      LEFT JOIN LATERAL (
      SELECT m.id, m.content, m."contentType", m."messageType", m.status, m."contentAttributes", m."createdAt"
        FROM "chat_messages" m
        WHERE m."conversationId" = c.id
        ORDER BY m."createdAt" DESC
        LIMIT 1
      ) lm ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as unread_count
        FROM "chat_messages" m2
        WHERE m2."conversationId" = c.id
          AND m2."messageType" = 'incoming'
          AND (c."agentLastSeenAt" IS NULL OR m2."createdAt" > c."agentLastSeenAt")
      ) uc ON true
      WHERE c."contactId" IN (${Prisma.join(contactIds)})
        AND c."inboxId" IN (${Prisma.join(inboxIds)})
      ORDER BY c."contactId", (CASE WHEN lm.id IS NOT NULL THEN 1 ELSE 0 END) DESC, c."lastActivityAt" DESC
    `);

    return rows.map((row) => ({
      contactId: row.contactId,
      conversationId: row.conversationId,
      inboxId: row.inboxId,
      lastActivityAt: row.lastActivityAt ?? null,
      waitingSince: row.waitingSince ?? null,
      agentLastSeenAt: row.agentLastSeenAt ?? null,
      status: row.status,
      unreadCount: row.unreadCount ?? 0,
      lastMessage:
        row.lastMessageId &&
          row.lastMessageCreatedAt &&
          row.lastMessageContentType &&
          row.lastMessageMessageType &&
          row.lastMessageStatus
          ? {
            id: row.lastMessageId,
            content: row.lastMessageContent,
            contentType: row.lastMessageContentType,
            messageType: row.lastMessageMessageType,
            status: row.lastMessageStatus,
            contentAttributes: row.lastMessageContentAttributes,
            createdAt: row.lastMessageCreatedAt,
          }
          : null,
    }));
  }

  async create(conversation: Omit<Conversation, 'id'>): Promise<Conversation> {
    const record = await prisma.chatConversation.create({
      data: {
        contactId: conversation.contactId,
        inboxId: conversation.inboxId,
        status: conversation.status,
        lastActivityAt: conversation.lastActivityAt,
        waitingSince: conversation.waitingSince,
        assigneeId: conversation.assigneeId,
      },
    });
    return this.mapToDomain(record);
  }

  async findById(id: string): Promise<Conversation | null> {
    const record = await prisma.chatConversation.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.mapToDomain(record);
  }

  async updateStatus(id: string, status: string): Promise<Conversation> {
    // Igual ao Chatwoot: limpa waitingSince quando resolve
    const data: any = { status };
    if (status === 'resolved') {
      data.waitingSince = null;
    }

    const record = await prisma.chatConversation.update({
      where: { id },
      data,
    });
    return this.mapToDomain(record);
  }

  async updateActivity(id: string, lastActivityAt: Date, waitingSince?: Date | null): Promise<Conversation> {
    const data: any = { lastActivityAt };
    if (waitingSince !== undefined) {
      data.waitingSince = waitingSince;
    }

    const record = await prisma.chatConversation.update({
      where: { id },
      data,
    });
    return this.mapToDomain(record);
  }

  async updateAssignee(id: string, assigneeId: string | null): Promise<Conversation> {
    const record = await prisma.chatConversation.update({
      where: { id },
      data: { assigneeId },
    });
    return this.mapToDomain(record);
  }

  async updateLastSeen(id: string, lastSeenAt: Date): Promise<Conversation> {
    const record = await prisma.chatConversation.update({
      where: { id },
      data: { agentLastSeenAt: lastSeenAt },
    });
    return this.mapToDomain(record);
  }

  async countUnreadMessages(conversationId: string, sinceDate: Date | null): Promise<number> {
    // Se não tem agentLastSeenAt, todas as incoming são não lidas
    const whereClause: any = {
      conversationId,
      messageType: 'incoming',
    };

    if (sinceDate) {
      whereClause.createdAt = { gt: sinceDate };
    }

    return prisma.chatMessage.count({ where: whereClause });
  }

  /**
   * Garante que existe uma conversa para o contato na inbox.
   * SEMPRE reutiliza a última conversa. Se estava 'resolved', o worker de chat vai reabrir depois.
   * Retorna { conversation, isNew, isReopened } para saber se criou nova ou reabriu uma resolvida.
   */
  async ensureConversation(contactId: string, inboxId: string): Promise<{ conversation: Conversation; isNew: boolean; isReopened: boolean }> {
    const existing = await this.findLastByContactAndInbox(contactId, inboxId);

    if (existing) {
      // Se a conversa existia mas estava fechada (resolved), marcamos como reabertura
      return {
        conversation: existing,
        isNew: false,
        isReopened: existing.status === 'resolved'
      };
    }

    // Não existe nenhuma conversa, criar nova
    try {
      const conversation = await this.create({
        contactId,
        inboxId,
        status: 'open',
      });
      return { conversation, isNew: true, isReopened: false };
    } catch (error: any) {
      // Race condition: outra thread pode ter criado
      const retryFind = await this.findLastByContactAndInbox(contactId, inboxId);
      if (retryFind) return { conversation: retryFind, isNew: false, isReopened: retryFind.status === 'resolved' };
      throw error;
    }
  }

  // Igual ao Chatwoot: busca a última mensagem 'incoming' da conversa
  async getLastIncomingMessageTimestamp(conversationId: string): Promise<Date | null> {
    const lastMessage = await prisma.chatMessage.findFirst({
      where: {
        conversationId,
        messageType: 'incoming',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    return lastMessage?.createdAt || null;
  }

  /**
   * Lista conversas com filtros e retorna contadores.
   * Retorna dados BRUTOS - regras de negócio ficam no UseCase.
   */
  async findWithFilters(filters: ConversationFilters, userId: string): Promise<ConversationListData> {
    const {
      status,
      inboxId,
      inboxIds,
      assigneeId,
      unassigned,
      waiting,
      sortBy = 'last_activity',
      sortOrder = 'desc',
      page = 1,
      limit = 25,
    } = filters;

    // ─────────────────────────────────────────────────────────────────────────
    // MONTAR WHERE CLAUSE
    // ─────────────────────────────────────────────────────────────────────────
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (inboxId) {
      where.inboxId = inboxId;
    } else if (Array.isArray(inboxIds) && inboxIds.length > 0) {
      where.inboxId = { in: inboxIds };
    }

    if (assigneeId) {
      where.assigneeId = assigneeId;
    }

    if (unassigned) {
      where.assigneeId = null;
    }

    if (waiting) {
      where.waitingSince = { not: null };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ORDENAÇÃO
    // ─────────────────────────────────────────────────────────────────────────
    const orderBy: any = {};
    switch (sortBy) {
      case 'waiting_since':
        orderBy.waitingSince = sortOrder;
        break;
      case 'created_at':
        orderBy.createdAt = sortOrder;
        break;
      case 'last_activity':
      default:
        orderBy.lastActivityAt = sortOrder;
        break;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PAGINAÇÃO
    // ─────────────────────────────────────────────────────────────────────────
    const skip = (page - 1) * limit;

    // ─────────────────────────────────────────────────────────────────────────
    // BUSCAR CONVERSAS
    // ─────────────────────────────────────────────────────────────────────────
    const [conversations, total] = await Promise.all([
      (prisma.chatConversation as any).findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              waId: true,
              avatarUrl: true,
              inboxes: {
                where: inboxId
                  ? { inboxId }
                  : Array.isArray(inboxIds) && inboxIds.length > 0
                    ? { inboxId: { in: inboxIds } }
                    : undefined,
                select: { inboxId: true, sourceId: true },
              },
              clients: {
                select: {
                  client: {
                    select: {
                      id: true,
                      razaoSocial: true,
                      nomeSindico: true,
                    },
                  },
                },
              },
            },
          },
          inbox: {
            select: {
              id: true,
              name: true,
              provider: true, // 'whatsapp_cloud', etc.
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              contentType: true,
              messageType: true,
              status: true,
              createdAt: true,
            },
          },
          chatbotSessions: {
            where: { status: 'ACTIVE' },
            take: 1,
            select: { status: true }
          }
        } as any,
      }),
      prisma.chatConversation.count({ where }),
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // BUSCAR DADOS BRUTOS PARA O USECASE CALCULAR
    // ─────────────────────────────────────────────────────────────────────────
    const conversationIds = conversations.map((c: any) => c.id);

    // Buscar última mensagem incoming de cada conversa (dado bruto para canReply)
    const lastIncomingMessages = conversationIds.length > 0
      ? await prisma.chatMessage.findMany({
        where: {
          conversationId: { in: conversationIds },
          messageType: 'incoming',
        },
        orderBy: { createdAt: 'desc' },
        distinct: ['conversationId'],
        select: {
          conversationId: true,
          createdAt: true,
        },
      })
      : [];

    // Criar mapa de conversationId -> última incoming createdAt
    const lastIncomingMap = new Map<string, Date>();
    for (const msg of lastIncomingMessages) {
      lastIncomingMap.set(msg.conversationId, msg.createdAt);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CALCULAR CONTADORES (sempre para status 'open')
    // ─────────────────────────────────────────────────────────────────────────
    const baseCountWhere: any = { status: 'open' };
    if (inboxId) {
      baseCountWhere.inboxId = inboxId;
    } else if (Array.isArray(inboxIds) && inboxIds.length > 0) {
      baseCountWhere.inboxId = { in: inboxIds };
    }

    const [mineCount, unassignedCount, allCount] = await Promise.all([
      prisma.chatConversation.count({
        where: { ...baseCountWhere, assigneeId: userId },
      }),
      prisma.chatConversation.count({
        where: { ...baseCountWhere, assigneeId: null },
      }),
      prisma.chatConversation.count({
        where: baseCountWhere,
      }),
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // MAPEAR RESULTADO (DADOS BRUTOS - sem regras de negócio)
    // ─────────────────────────────────────────────────────────────────────────
    const mappedConversations: ConversationWithRelations[] = conversations.map((conv: any) => ({
      id: conv.id,
      contactId: conv.contactId,
      inboxId: conv.inboxId,
      status: conv.status,
      assigneeId: conv.assigneeId,
      waitingSince: conv.waitingSince,
      lastActivityAt: conv.lastActivityAt,
      agentLastSeenAt: conv.agentLastSeenAt,
      chatbotStatus: (conv.chatbotSessions?.[0]?.status as any) || null,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      contact: {
        id: conv.contact.id,
        name: conv.contact.name,
        waId: conv.contact.waId,
        avatarUrl: conv.contact.avatarUrl,
        phoneNumber:
          conv.contact.inboxes?.find((link: any) => link.inboxId === conv.inboxId)
            ?.sourceId || null,
        clients: (conv.contact.clients || []).map((link: any) => ({
          id: link.client.id,
          razaoSocial: link.client.razaoSocial,
          nomeSindico: link.client.nomeSindico,
        })),
      },
      inbox: {
        id: conv.inbox.id,
        name: conv.inbox.name,
        channelType: conv.inbox.provider || 'whatsapp_cloud',
      },
      assignee: conv.assignee ? {
        id: conv.assignee.id,
        name: conv.assignee.name,
        email: conv.assignee.email,
      } : null,
      lastMessage: conv.messages[0] ? {
        id: conv.messages[0].id,
        content: conv.messages[0].content,
        contentType: conv.messages[0].contentType,
        messageType: conv.messages[0].messageType,
        status: conv.messages[0].status,
        createdAt: conv.messages[0].createdAt,
      } : null,
      // Dados brutos para o UseCase calcular
      lastIncomingAt: lastIncomingMap.get(conv.id) || null,
    }));

    const counts: ConversationCounts = {
      mine: mineCount,
      unassigned: unassignedCount,
      all: allCount,
    };

    return {
      conversations: mappedConversations,
      counts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Busca uma conversa por ID com todas as relações.
   * Retorna dados BRUTOS - regras de negócio ficam no UseCase.
   */
  async findByIdWithRelations(id: string): Promise<ConversationWithRelations | null> {
    const conv: any = await prisma.chatConversation.findUnique({
      where: { id },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            waId: true,
            avatarUrl: true,
            inboxes: {
              select: {
                inboxId: true,
                sourceId: true,
              },
            },
            clients: {
              select: {
                client: {
                  select: {
                    id: true,
                    razaoSocial: true,
                    nomeSindico: true,
                  },
                },
              },
            },
          },
        },
        inbox: {
          select: {
            id: true,
            name: true,
            provider: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            contentType: true,
            messageType: true,
            status: true,
            createdAt: true,
          },
        },
        chatbotSessions: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: { status: true }
        }
      },
    });

    if (!conv) return null;

    // Buscar última mensagem incoming para calcular canReply
    const lastIncoming = await prisma.chatMessage.findFirst({
      where: {
        conversationId: id,
        messageType: 'incoming',
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return {
      id: conv.id,
      contactId: conv.contactId,
      inboxId: conv.inboxId,
      status: conv.status,
      assigneeId: conv.assigneeId,
      waitingSince: conv.waitingSince,
      lastActivityAt: conv.lastActivityAt,
      agentLastSeenAt: conv.agentLastSeenAt,
      chatbotStatus: (conv.chatbotSessions?.[0]?.status as any) || null,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      contact: {
        id: conv.contact.id,
        name: conv.contact.name,
        waId: conv.contact.waId,
        avatarUrl: conv.contact.avatarUrl,
        phoneNumber:
          conv.contact.inboxes?.find((link: any) => link.inboxId === conv.inboxId)
            ?.sourceId || null,
        clients: (conv.contact.clients || []).map((link: any) => ({
          id: link.client.id,
          razaoSocial: link.client.razaoSocial,
          nomeSindico: link.client.nomeSindico,
        })),
      },
      inbox: {
        id: conv.inbox.id,
        name: conv.inbox.name,
        channelType: conv.inbox.provider || 'whatsapp_cloud',
      },
      assignee: conv.assignee ? {
        id: conv.assignee.id,
        name: conv.assignee.name,
        email: conv.assignee.email,
      } : null,
      lastMessage: conv.messages[0] ? {
        id: conv.messages[0].id,
        content: conv.messages[0].content,
        contentType: conv.messages[0].contentType,
        messageType: conv.messages[0].messageType,
        status: conv.messages[0].status,
        createdAt: conv.messages[0].createdAt,
      } : null,
      lastIncomingAt: lastIncoming?.createdAt || null,
    };
  }

  /**
   * Retorna contagens de conversas por status para uma inbox.
   * @param inboxId ID da inbox
   * @param assigneeId Se informado, filtra só conversas desse assignee
   */
  async countByStatus(inboxId: string, assigneeId?: string): Promise<StatusCounts> {
    // Base where condition
    const baseWhere: Record<string, unknown> = { inboxId };
    if (assigneeId) {
      baseWhere.assigneeId = assigneeId;
    }

    // Contagens em paralelo (eficiente)
    const [openCount, waitingCount, resolvedCount] = await Promise.all([
      // Open: status='open' (inclui waiting)
      prisma.chatConversation.count({
        where: {
          ...baseWhere,
          status: 'open',
        },
      }),
      // Waiting: status='open' E waitingSince IS NOT NULL
      prisma.chatConversation.count({
        where: {
          ...baseWhere,
          status: 'open',
          waitingSince: { not: null },
        },
      }),
      // Resolved: status='resolved'
      prisma.chatConversation.count({
        where: {
          ...baseWhere,
          status: 'resolved',
        },
      }),
    ]);

    return {
      open: openCount,
      waiting: waitingCount,
      resolved: resolvedCount,
    };
  }

  private mapToDomain(record: any): Conversation {
    return {
      id: record.id,
      contactId: record.contactId,
      inboxId: record.inboxId,
      status: record.status,
      assigneeId: record.assigneeId,
      waitingSince: record.waitingSince,
      lastActivityAt: record.lastActivityAt,
      agentLastSeenAt: record.agentLastSeenAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
