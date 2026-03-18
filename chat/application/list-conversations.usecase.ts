import {
  IConversationRepository,
  ConversationFilters,
  ConversationListResult,
  ConversationWithDetails,
  ConversationWithRelations,
} from '../domain/repositories/conversation-repository';

// ============================================================================
// TIPOS DE ENTRADA/SAÍDA
// ============================================================================

export type ListConversationsInput = {
  userId: string;              // ID do usuário logado (para filtro "me")
  assignee?: 'me' | 'unassigned' | 'all';  // Filtro de atribuição
  assigneeId?: string;         // Filtro por assignee específico (somente quando assignee='all')
  status?: 'open' | 'resolved' | 'pending' | 'all';  // Filtro de status
  waiting?: boolean;           // Só conversas esperando resposta
  inboxId?: string;            // Filtrar por inbox
  inboxIds?: string[];         // Filtrar por múltiplas inboxes
  page?: number;               // Página atual
  limit?: number;              // Itens por página
  sortBy?: 'last_activity' | 'waiting_since' | 'created_at';
  sortOrder?: 'asc' | 'desc';
};

export type ListConversationsOutput = ConversationListResult;

// ============================================================================
// CONSTANTES DE NEGÓCIO
// ============================================================================

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// USE CASE
// ============================================================================

/**
 * Lista conversas com filtros e contadores.
 * Aplica regras de negócio sobre os dados brutos do repositório.
 */
export class ListConversationsUseCase {
  constructor(
    private readonly conversationRepository: IConversationRepository
  ) { }

  async execute(input: ListConversationsInput): Promise<ListConversationsOutput> {
    const {
      userId,
      assignee = 'all',
      assigneeId,
      status = 'open',
      waiting,
      inboxId,
      inboxIds,
      page = 1,
      limit = 25,
      sortBy = 'last_activity',
      sortOrder = 'desc',
    } = input;

    // Montar filtros
    const filters: ConversationFilters = {
      status: status === 'all' ? undefined : status,
      inboxId,
      inboxIds,
      waiting,
      sortBy,
      sortOrder,
      page,
      limit,
    };

    // Aplicar filtro de assignee
    if (assignee === 'me') {
      filters.assigneeId = userId;
    } else if (assignee === 'unassigned') {
      filters.unassigned = true;
    }
    // 'all' não filtra por assignee
    if (assignee === 'all' && assigneeId) {
      filters.assigneeId = assigneeId;
    }

    // Buscar dados brutos do repositório
    const rawData = await this.conversationRepository.findWithFilters(filters, userId);

    // Calcular unreadCount para cada conversa (batch)
    const conversationsWithUnread = await Promise.all(
      rawData.conversations.map(conv => this.applyBusinessRules(conv))
    );

    return {
      conversations: conversationsWithUnread,
      counts: rawData.counts,
      pagination: rawData.pagination,
    };
  }

  /**
   * Aplica regras de negócio sobre os dados brutos de uma conversa.
   * Calcula unreadCount dinamicamente igual ao Chatwoot.
   */
  private async applyBusinessRules(conv: ConversationWithRelations): Promise<ConversationWithDetails> {
    const now = new Date();

    // REGRA: canReply = última incoming foi há menos de 24h
    const canReply = this.calculateCanReply(conv.lastIncomingAt, now);

    // REGRA: unreadCount = mensagens incoming após agentLastSeenAt (Chatwoot style)
    const unreadCount = await this.conversationRepository.countUnreadMessages(
      conv.id,
      conv.agentLastSeenAt || null
    );

    return {
      ...conv,
      canReply,
      unreadCount,
      chatbotStatus: conv.chatbotStatus || null,
    };
  }

  /**
   * Verifica se a conversa está dentro da janela de 24h.
   */
  private calculateCanReply(lastIncomingAt: Date | null | undefined, now: Date): boolean {
    if (!lastIncomingAt) return false;

    const timeSinceLastIncoming = now.getTime() - lastIncomingAt.getTime();
    return timeSinceLastIncoming < TWENTY_FOUR_HOURS_MS;
  }
}

