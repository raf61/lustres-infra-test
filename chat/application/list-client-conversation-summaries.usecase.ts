import { IClientChatContactRepository } from '../domain/repositories/client-chat-contact-repository';
import { IConversationRepository } from '../domain/repositories/conversation-repository';
import { IInboxRepository } from '../domain/repositories/inbox-repository';
import { IInboxAccessPolicy, InboxAccessContext } from '../domain/policies/inbox-access-policy';

export type ClientConversationSummary = {
  clientId: number;
  conversationId: string;
  inboxId: string;
  lastActivityAt: Date | null;
  waitingSince: Date | null;
  agentLastSeenAt: Date | null;
  status: string;
  unreadCount: number;
  lastMessage: {
    id: string;
    content: string | null;
    contentType: string;
    messageType: string;
    status: string;
    contentAttributes?: any;
    createdAt: Date;
  } | null;
};

export type ListClientConversationSummariesInput = {
  clientIds: number[];
  userId: string;
  role?: string | null;
};

export type ListClientConversationSummariesOutput = {
  summaries: ClientConversationSummary[];
};

/**
 * UseCase: listar resumo da conversa mais recente por cliente.
 */
export class ListClientConversationSummariesUseCase {
  constructor(
    private readonly clientChatContactRepository: IClientChatContactRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly inboxRepository: IInboxRepository,
    private readonly inboxAccessPolicy: IInboxAccessPolicy
  ) { }

  async execute(
    input: ListClientConversationSummariesInput
  ): Promise<ListClientConversationSummariesOutput> {
    const clientIds = Array.from(new Set(input.clientIds)).filter((id) => Number.isFinite(id));
    if (clientIds.length === 0) {
      return { summaries: [] };
    }

    const inboxes = await this.inboxRepository.findAllWithOpenCount();
    const allowed = await this.inboxAccessPolicy.filter(inboxes, {
      userId: input.userId,
      role: input.role ?? null,
    } as InboxAccessContext);
    const allowedInboxIds = allowed.map((inbox) => inbox.id);
    if (allowedInboxIds.length === 0) {
      return { summaries: [] };
    }

    const contactsByClient = await this.clientChatContactRepository.findContactIdsByClientIds(
      clientIds
    );

    const allContactIds = Array.from(
      new Set(Object.values(contactsByClient).flat())
    );

    if (allContactIds.length === 0) {
      return { summaries: [] };
    }

    const latestByContact = await this.conversationRepository.findLatestSummariesByContactIds(
      allContactIds,
      allowedInboxIds
    );

    const latestContactMap = new Map(
      latestByContact.map((item) => [item.contactId, item])
    );

    // Create a template map for easy lookups
    const templateMap = new Map<string, Map<string, string>>();
    for (const inbox of inboxes) {
      const inboxTemplates = new Map<string, string>();
      if (inbox.messageTemplates && Array.isArray(inbox.messageTemplates)) {
        for (const t of inbox.messageTemplates) {
          if (t.name && t.components) {
            const body = t.components.find((c: any) => c.type?.toUpperCase() === 'BODY' || c.type?.toLowerCase() === 'body')?.text;
            if (body) {
              inboxTemplates.set(t.name, body);
            }
          }
        }
      }
      templateMap.set(inbox.id, inboxTemplates);
    }

    const summaries: ClientConversationSummary[] = [];

    for (const clientId of clientIds) {
      const contactIds = contactsByClient[clientId] || [];
      if (contactIds.length === 0) continue;

      let best = null as typeof latestByContact[number] | null;
      for (const contactId of contactIds) {
        const summary = latestContactMap.get(contactId);
        if (!summary) continue;
        if (!best) {
          best = summary;
          continue;
        }

        const bestHasMsg = !!best.lastMessage;
        const currentHasMsg = !!summary.lastMessage;

        if (currentHasMsg && !bestHasMsg) {
          best = summary;
        } else if (currentHasMsg === bestHasMsg) {
          const bestTime = best.lastActivityAt ? best.lastActivityAt.getTime() : 0;
          const currentTime = summary.lastActivityAt ? summary.lastActivityAt.getTime() : 0;
          if (currentTime >= bestTime) {
            best = summary;
          }
        }
      }

      if (!best) continue;

      let content = best.lastMessage?.content ?? null;
      if (best.lastMessage?.contentType === 'template' && content) {
        // Resolve template content body if content is just a name
        const inboxTemplates = templateMap.get(best.inboxId);
        if (inboxTemplates && (inboxTemplates.has(content) || inboxTemplates.has(content.toLowerCase()))) {
          const body = inboxTemplates.get(content) || inboxTemplates.get(content.toLowerCase());
          if (body) content = body;
        }

        // Interpolate variables if contentAttributes are present
        let contentAttributes = best.lastMessage.contentAttributes;
        // Ensure it's an object (sometimes queryRaw returns it as a string)
        if (typeof contentAttributes === 'string') {
          try {
            contentAttributes = JSON.parse(contentAttributes);
          } catch (e) {
            contentAttributes = null;
          }
        }

        if (contentAttributes?.template?.components) {
          const bodyParams = contentAttributes.template.components.find(
            (c: any) => c.type?.toLowerCase() === 'body'
          )?.parameters;

          if (Array.isArray(bodyParams)) {
            bodyParams.forEach((param: any, index: number) => {
              let value = '';
              if (param.type === 'text') value = param.text;
              else if (param.type === 'currency') value = String(param.currency?.fallback_value || '');
              else if (param.type === 'date_time') value = String(param.date_time?.fallback_value || '');

              if (value !== undefined && value !== null) {
                const valStr = String(value);
                // Try named placeholder first
                if (param.parameter_name) {
                  const namedPlaceholder = `{{${param.parameter_name}}}`;
                  content = content!.split(namedPlaceholder).join(valStr);
                }

                // Also try positional placeholder
                const positionalPlaceholder = `{{${index + 1}}}`;
                content = content!.split(positionalPlaceholder).join(valStr);
              }
            });
          }
        }
      }

      summaries.push({
        clientId,
        conversationId: best.conversationId,
        inboxId: best.inboxId,
        lastActivityAt: best.lastActivityAt ?? null,
        waitingSince: best.waitingSince ?? null,
        agentLastSeenAt: best.agentLastSeenAt ?? null,
        status: best.status,
        unreadCount: best.unreadCount,
        lastMessage: best.lastMessage
          ? {
            id: best.lastMessage.id,
            content: content,
            contentType: best.lastMessage.contentType,
            messageType: best.lastMessage.messageType,
            status: best.lastMessage.status,
            contentAttributes: best.lastMessage.contentAttributes,
            createdAt: best.lastMessage.createdAt,
          }
          : null,
      });
    }

    return { summaries };
  }
}

