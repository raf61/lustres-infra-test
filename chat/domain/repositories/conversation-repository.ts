import { Conversation } from '../conversation';

// ============================================================================
// TIPOS PARA LISTAGEM
// ============================================================================

export type ConversationFilters = {
  status?: string;           // 'open', 'resolved', 'pending'
  inboxId?: string;          // Filtrar por inbox
  inboxIds?: string[];       // Filtrar por múltiplas inboxes
  assigneeId?: string;       // Filtrar por assignee específico (para "me")
  unassigned?: boolean;      // Só conversas sem assignee
  waiting?: boolean;         // Só conversas com waitingSince != null
  sortBy?: 'last_activity' | 'waiting_since' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

// Dados brutos retornados pelo repositório (sem regras de negócio)
export type ConversationWithRelations = Conversation & {
  contact: {
    id: string;
    name: string | null;
    waId: string;
    avatarUrl?: string | null;
    phoneNumber?: string | null;
    clients?: Array<{
      id: number;
      razaoSocial: string;
    }>;
  };
  inbox: {
    id: string;
    name: string;
    channelType: string;  // 'whatsapp_cloud', etc.
  };
  assignee?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  lastMessage?: {
    id: string;
    content: string | null;
    contentType: string;
    messageType: string;
    status: string;
    createdAt: Date;
  } | null;
  // Dados brutos para cálculo no UseCase
  lastIncomingAt?: Date | null;  // Para calcular canReply
  chatbotStatus?: string | null;  // Adicionado para listagem
};

// Tipo final com campos calculados (retornado pelo UseCase)
export type ConversationWithDetails = ConversationWithRelations & {
  unreadCount: number;      // Calculado no UseCase
  canReply: boolean;        // Calculado no UseCase (janela 24h)
  chatbotStatus: string | null; // Status atual do chatbot
};

export type ConversationCounts = {
  mine: number;        // Conversas atribuídas ao userId
  unassigned: number;  // Conversas sem assignee
  all: number;         // Todas as conversas (open)
};

/** Contagens por status para uma inbox específica */
export type StatusCounts = {
  open: number;     // status='open' (inclui waiting)
  waiting: number;  // status='open' e waitingSince IS NOT NULL
  resolved: number; // status='resolved'
};

// Resultado do repositório (dados brutos)
export type ConversationListData = {
  conversations: ConversationWithRelations[];
  counts: ConversationCounts;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

// Resultado final do UseCase (com campos calculados)
export type ConversationListResult = {
  conversations: ConversationWithDetails[];
  counts: ConversationCounts;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ConversationLatestSummaryByContact = {
  contactId: string;
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

// ============================================================================
// INTERFACE DO REPOSITÓRIO
// ============================================================================

export interface IConversationRepository {
  /**
   * Busca a última conversa do contato na inbox (qualquer status).
   * Comportamento: sempre reutiliza a mesma conversa.
   */
  findLastByContactAndInbox(contactId: string, inboxId: string): Promise<Conversation | null>;

  /**
   * Busca a conversa mais recente entre vários contatos e inboxes.
   */
  findLatestByContactsAndInboxes(
    contactIds: string[],
    inboxIds: string[]
  ): Promise<Conversation | null>;

  /**
   * Busca a conversa mais recente com relações (lastMessage, contact, inbox).
   */
  findLatestWithRelationsByContactsAndInboxes(
    contactIds: string[],
    inboxIds: string[]
  ): Promise<ConversationWithRelations | null>;

  /**
   * Busca a conversa mais recente por contato (bulk) com último texto e unreadCount.
   */
  findLatestSummariesByContactIds(
    contactIds: string[],
    inboxIds: string[]
  ): Promise<ConversationLatestSummaryByContact[]>;

  create(conversation: Omit<Conversation, 'id'>): Promise<Conversation>;
  findById(id: string): Promise<Conversation | null>;
  updateStatus(id: string, status: string): Promise<Conversation>;
  updateActivity(id: string, lastActivityAt: Date, waitingSince?: Date | null): Promise<Conversation>;
  updateAssignee(id: string, assigneeId: string | null): Promise<Conversation>;

  /**
   * Garante que existe uma conversa para o contato na inbox.
   * Sempre reutiliza a última conversa (reabre se estava resolved).
   * Retorna { conversation, isNew, isReopened } para saber se criou nova ou reabriu.
   */
  ensureConversation(contactId: string, inboxId: string): Promise<{ conversation: Conversation; isNew: boolean; isReopened: boolean }>;

  // Para controle da janela de 24h (Igual ao Chatwoot - busca dinâmica)
  getLastIncomingMessageTimestamp(conversationId: string): Promise<Date | null>;

  /**
   * Lista conversas com filtros e retorna contadores.
   * Retorna dados BRUTOS - regras de negócio ficam no UseCase.
   * @param filters Filtros de busca
   * @param userId ID do usuário logado (para calcular mine_count)
   */
  findWithFilters(filters: ConversationFilters, userId: string): Promise<ConversationListData>;

  /**
   * Busca uma conversa por ID com todas as relações.
   * Retorna dados BRUTOS - regras de negócio ficam no UseCase.
   */
  findByIdWithRelations(id: string): Promise<ConversationWithRelations | null>;

  /**
   * Atualiza agentLastSeenAt para marcar que o agente viu a conversa.
   * Usado para calcular unreadCount dinamicamente (igual Chatwoot).
   */
  updateLastSeen(id: string, lastSeenAt: Date): Promise<Conversation>;

  /**
   * Conta mensagens incoming após uma data (para calcular unreadCount).
   */
  countUnreadMessages(conversationId: string, sinceDate: Date | null): Promise<number>;

  /**
   * Retorna contagens de conversas por status para uma inbox.
   * @param inboxId ID da inbox
   * @param assigneeId Se informado, filtra só conversas desse assignee
   */
  countByStatus(inboxId: string, assigneeId?: string): Promise<StatusCounts>;
}
