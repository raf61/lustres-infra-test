import { 
  IMessageRepository, 
  MessageFilters,
  MessageWithRelations,
} from '../domain/repositories/message-repository';

// ============================================================================
// TIPOS DE ENTRADA/SAÍDA
// ============================================================================

export type ListMessagesInput = {
  conversationId: string;
  before?: string;   // ISO date string (cursor para histórico)
  after?: string;    // ISO date string (cursor para novas)
  limit?: number;
};

export type MessageWithSender = MessageWithRelations & {
  sender?: {
    type: 'contact' | 'user';
    id: string;
    name: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type ListMessagesOutput = {
  messages: MessageWithSender[];
  meta: {
    hasMore: boolean;
    oldestCursor?: string;   // ISO date para próximo ?before=
    newestCursor?: string;   // ISO date para próximo ?after=
  };
};

// ============================================================================
// USE CASE
// ============================================================================

/**
 * Lista mensagens de uma conversa com paginação por cursor.
 * Aplica regras de negócio sobre os dados brutos do repositório.
 */
export class ListMessagesUseCase {
  constructor(
    private readonly messageRepository: IMessageRepository
  ) {}

  async execute(input: ListMessagesInput): Promise<ListMessagesOutput> {
    const { conversationId, before, after, limit = 20 } = input;

    // Parsear cursores (datas em ISO string)
    const filters: MessageFilters = {
      limit: Math.min(limit, 100), // Máximo 100 por request
    };

    if (before) {
      filters.before = this.parseDate(before);
    } else if (after) {
      filters.after = this.parseDate(after);
    }

    // Buscar dados brutos do repositório
    const rawData = await this.messageRepository.findByConversation(conversationId, filters);

    // Aplicar regras de negócio (determinar sender)
    const messages = rawData.messages.map(msg => this.applyBusinessRules(msg));

    return {
      messages,
      meta: {
        hasMore: rawData.hasMore,
        oldestCursor: rawData.oldestCreatedAt?.toISOString(),
        newestCursor: rawData.newestCreatedAt?.toISOString(),
      },
    };
  }

  /**
   * Parseia uma string de data.
   * Aceita ISO string ou timestamp em ms.
   */
  private parseDate(dateStr: string): Date {
    // Se for número (timestamp), converter
    const timestamp = Number(dateStr);
    if (!isNaN(timestamp)) {
      return new Date(timestamp);
    }
    // Senão, assumir ISO string
    return new Date(dateStr);
  }

  /**
   * Aplica regra de negócio: determinar quem é o sender da mensagem.
   */
  private applyBusinessRules(msg: MessageWithRelations): MessageWithSender {
    let sender: MessageWithSender['sender'] = null;

    // REGRA: Se incoming, sender é o contato
    if (msg.messageType === 'incoming') {
      if (msg.contact) {
        sender = {
          type: 'contact',
          id: msg.contact.id,
          name: msg.contact.name,
          avatarUrl: msg.contact.avatarUrl,
        };
      }
    }
    // REGRA: Se outgoing/template, sender é o usuário (agente)
    else if (msg.messageType === 'outgoing' || msg.messageType === 'template') {
      const senderId = msg.contentAttributes?.senderId;
      if (senderId) {
        sender = {
          type: 'user',
          id: senderId,
          name: msg.contentAttributes?.senderName || null,
          avatarUrl: null,
        };
      }
    }
    // activity messages não têm sender

    return {
      ...msg,
      sender,
    };
  }
}

