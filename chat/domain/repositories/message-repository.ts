// ============================================================================
// TIPOS
// ============================================================================

export type CreateMessageData = {
  conversationId: string;
  providerMessageId?: string;
  messageType: 'incoming' | 'outgoing' | 'template' | 'activity';
  contentType: string;
  content?: string;
  status?: string;
  timestamp?: Date;
  contentAttributes?: Record<string, any>;
  additionalAttributes?: Record<string, any>;
  attachments?: {
    fileType: string;
    mediaId?: string;
    externalUrl?: string | null;
    fileUrl?: string | null;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    downloadStatus?: string;
  }[];
};

export type MessageRecord = {
  id: string;
  conversationId: string;
  providerMessageId?: string | null;
  messageType: string;
  contentType: string;
  content?: string | null;
  status: string;
  externalError?: string | null;
  timestamp?: Date | null;
  contentAttributes?: Record<string, any>;
  additionalAttributes?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  attachments?: {
    id: string;
    fileType: string;
    mediaId?: string | null;
    externalUrl?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
    mimeType?: string | null;
  }[];
  // Relações opcionais para envio
  conversation?: {
    id: string;
    inboxId: string;  // Para routing de broadcasts
    sourceId: string; // Identificador do contato NESTE canal
    inbox: {
      phoneNumberId: string;
      settings: any;
    };
  };
  // Campo auxiliar para broadcasts (adicionado em updateStatus)
  inboxId?: string;
  contactId?: string;
};

// ============================================================================
// TIPOS PARA LISTAGEM DE MENSAGENS
// ============================================================================

export type MessageFilters = {
  before?: Date;       // Cursor: buscar mensagens ANTES desta data (histórico)
  after?: Date;        // Cursor: buscar mensagens APÓS esta data (novas)
  limit?: number;      // Limite de mensagens (default: 20)
};

// Dados brutos do repositório (sem regras de negócio)
export type MessageWithRelations = MessageRecord & {
  inboxId?: string;  // ID da inbox (para o front saber de qual canal é)
  contact?: {
    id: string;
    name: string | null;
    avatarUrl?: string | null;
  } | null;
};

// Resultado bruto do repositório
export type MessageListData = {
  messages: MessageWithRelations[];
  hasMore: boolean;
  oldestCreatedAt?: Date;
  newestCreatedAt?: Date;
};

// ============================================================================
// INTERFACE DO REPOSITÓRIO
// ============================================================================

export interface IMessageRepository {
  create(data: CreateMessageData): Promise<MessageRecord | null>;
  findById(id: string): Promise<MessageRecord | null>;
  findByProviderMessageId(providerMessageId: string): Promise<MessageRecord | null>;

  /**
   * Atualiza status de mensagem (via webhook do provedor)
   * Retorna dados necessários para broadcast incluindo conversationId e inboxId
   */
  updateStatus(providerMessageId: string, status: string, externalError?: string): Promise<MessageRecord | null>;

  /**
   * Busca o status atual de uma mensagem pelo providerMessageId
   */
  getStatus(providerMessageId: string): Promise<string | null>;

  updateAfterSend(id: string, data: { providerMessageId: string; status: string }): Promise<MessageRecord | null>;
  markAsFailed(id: string, error: string): Promise<MessageRecord | null>;
  getStatusesByProviderIds(providerIds: string[]): Promise<Map<string, string>>;

  /**
   * Lista mensagens de uma conversa com paginação por cursor.
   * Retorna dados BRUTOS - regras de negócio ficam no UseCase.
   */
  findByConversation(conversationId: string, filters: MessageFilters): Promise<MessageListData>;
}
