import { Prisma, PrismaClient } from '@prisma/client';
import { ChatAssigneeScope } from '../domain/policies/chat-role-policy';

export interface SearchContactsInput {
  query: string;
  inboxId: string;
  page: number;
  pageSize: number;
  assigneeScope?: ChatAssigneeScope;
}

export interface ContactSearchResult {
  contactId: string;
  contactName: string | null;
  phoneNumber: string | null; // sourceId do ContactInbox
  avatarUrl: string | null;
  associatedClients: Array<{
    clientId: number;
    razaoSocial: string;
  }>;
}

export interface SearchContactsOutput {
  contacts: ContactSearchResult[];
  hasMore: boolean;
  total: number;
}

export class SearchContactsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(input: SearchContactsInput): Promise<SearchContactsOutput> {
    const { query, inboxId, page, pageSize, assigneeScope } = input;
    
    if (!query.trim()) {
      return { contacts: [], hasMore: false, total: 0 };
    }

    const normalizedQuery = this.normalizeForSearch(query);
    const offset = (page - 1) * pageSize;

    // Busca contatos que:
    // 1. Têm um ContactInbox para a inbox especificada
    // 2. Match por: sourceId (telefone), nome do contato, ou razaoSocial de cliente associado
    const restrictAssignee =
      assigneeScope?.mode === 'mine_or_unassigned' && Boolean(assigneeScope.userId);
    const assigneeId = assigneeScope?.mode === 'mine_or_unassigned' ? assigneeScope.userId : null;
    const assigneeConstraint = restrictAssignee
      ? Prisma.sql`
        AND (
          conv.id IS NOT NULL
          AND (conv."assigneeId" = ${assigneeId} OR conv."assigneeId" IS NULL)
        )
      `
      : Prisma.empty;

    const results = await this.prisma.$queryRaw<Array<{
      contact_id: string;
      contact_name: string | null;
      phone_number: string | null;
      avatar_url: string | null;
    }>>(Prisma.sql`
      SELECT DISTINCT ON (c.id)
        c.id as contact_id,
        c.name as contact_name,
        ci."sourceId" as phone_number,
        c."avatarUrl" as avatar_url
      FROM chat_contacts c
      INNER JOIN chat_contact_inboxes ci ON ci."contactId" = c.id
      LEFT JOIN "chat_conversations" conv
        ON conv."contactId" = c.id
        AND conv."inboxId" = ci."inboxId"
      LEFT JOIN client_chat_contacts ccc ON ccc."contactId" = c.id
      LEFT JOIN "Client" cl ON cl.id = ccc."clientId"
      WHERE ci."inboxId" = ${inboxId}
        ${assigneeConstraint}
        AND (
          -- Busca por telefone (sourceId normalizado)
          regexp_replace(COALESCE(ci."sourceId", ''), '[^0-9]', '', 'g') ILIKE ${'%' + normalizedQuery + '%'}
          -- Busca por nome do contato
          OR LOWER(COALESCE(c.name, '')) LIKE ${'%' + normalizedQuery.toLowerCase() + '%'}
          -- Busca por razão social do cliente associado
          OR LOWER(COALESCE(cl."razaoSocial", '')) LIKE ${'%' + normalizedQuery.toLowerCase() + '%'}
        )
      ORDER BY c.id, c."updatedAt" DESC
      LIMIT ${pageSize + 1}
      OFFSET ${offset}
    `);

    // Verifica se há mais resultados
    const hasMore = results.length > pageSize;
    const contactsPage = hasMore ? results.slice(0, pageSize) : results;

    // Buscar clientes associados para cada contato
    const contactIds = contactsPage.map(r => r.contact_id);
    
    const clientAssociations = contactIds.length > 0 
      ? await this.prisma.clientChatContact.findMany({
          where: { contactId: { in: contactIds } },
          include: {
            client: {
              select: { id: true, razaoSocial: true }
            }
          }
        })
      : [];

    // Agrupar clientes por contactId
    const clientsByContact = new Map<string, Array<{ clientId: number; razaoSocial: string }>>();
    for (const assoc of clientAssociations) {
      const existing = clientsByContact.get(assoc.contactId) || [];
      existing.push({
        clientId: assoc.client.id,
        razaoSocial: assoc.client.razaoSocial
      });
      clientsByContact.set(assoc.contactId, existing);
    }

    // Montar resultado final
    const contacts: ContactSearchResult[] = contactsPage.map(r => ({
      contactId: r.contact_id,
      contactName: r.contact_name,
      phoneNumber: r.phone_number,
      avatarUrl: r.avatar_url,
      associatedClients: clientsByContact.get(r.contact_id) || []
    }));

    // Contar total (para informação)
    const countResult = await this.prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
      SELECT COUNT(DISTINCT c.id) as count
      FROM chat_contacts c
      INNER JOIN chat_contact_inboxes ci ON ci."contactId" = c.id
      LEFT JOIN "chat_conversations" conv
        ON conv."contactId" = c.id
        AND conv."inboxId" = ci."inboxId"
      LEFT JOIN client_chat_contacts ccc ON ccc."contactId" = c.id
      LEFT JOIN "Client" cl ON cl.id = ccc."clientId"
      WHERE ci."inboxId" = ${inboxId}
        ${assigneeConstraint}
        AND (
          regexp_replace(COALESCE(ci."sourceId", ''), '[^0-9]', '', 'g') ILIKE ${'%' + normalizedQuery + '%'}
          OR LOWER(COALESCE(c.name, '')) LIKE ${'%' + normalizedQuery.toLowerCase() + '%'}
          OR LOWER(COALESCE(cl."razaoSocial", '')) LIKE ${'%' + normalizedQuery.toLowerCase() + '%'}
        )
    `);

    return {
      contacts,
      hasMore,
      total: Number(countResult[0].count)
    };
  }

  private normalizeForSearch(query: string): string {
    // Remove tudo que não é número ou letra
    return query.replace(/[^a-zA-Z0-9]/g, '');
  }
}

