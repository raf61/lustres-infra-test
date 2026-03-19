// ════════════════════════════════════════════════════════════════════════════
// CHAT API SERVICE
// ════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  name?: string;
  phoneNumber?: string;
  email?: string;
  avatarUrl?: string;
  clients?: Array<{
    id: number;
    razaoSocial: string;
    nomeSindico?: string;
    cidade?: string;
    kanbanEstado?: {
      code: number;
    };
  }>;
}

export interface Inbox {
  id: string;
  name: string;
  channelType?: string;  // Para conversas (retorna channelType do backend)
  provider?: string;     // Para listagem de inboxes (retorna provider)
  phoneNumber?: string | null;
  openConversationsCount?: number;
  createdAt?: string | null;
}

export interface ChatAssigneeUser {
  id: string
  name: string
  email: string
  role: string
}

export interface Message {
  id: string;
  conversationId: string;
  content?: string | null;
  contentType: string;
  messageType: "incoming" | "outgoing" | "template";
  status: string;
  externalError?: string | null;  // Erro retornado pelo provedor (ex: "131047: Rate limit exceeded")
  timestamp: string | null;
  createdAt: string;
  attachments?: Attachment[];
  contentAttributes?: Record<string, unknown>;
}

export interface Attachment {
  id: string;
  fileType: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  downloadStatus?: "pending" | "downloading" | "completed" | "failed";
}

export interface Conversation {
  id: string;
  status: "open" | "resolved" | "pending";
  waitingSince?: string | null;
  lastActivityAt?: string | null;
  agentLastSeenAt?: string | null;
  assigneeId?: string | null;
  assignee?: { id: string; name: string | null; email?: string } | null;
  inboxId: string;
  contactId: string;
  contact?: Contact;
  inbox?: Inbox;
  lastMessage?: Message | null;
  unreadCount?: number;
  canReply?: boolean;
  chatbotStatus?: "ACTIVE" | "PAUSED" | "COMPLETED" | null;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PARÂMETROS
// ─────────────────────────────────────────────────────────────────────────────

export interface ListConversationsParams {
  assignee?: "me" | "unassigned" | "all";  // Minhas | Não atribuídas | Todas
  status?: "open" | "resolved" | "all";     // Abertas | Resolvidas | Todas
  inboxId?: string;                          // Filtrar por inbox
  assigneeId?: string;                       // Filtrar por assignee específico
  waiting?: boolean;                         // Só conversas esperando resposta
  sortBy?: "last_activity" | "waiting_since" | "created_at";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface ListMessagesParams {
  before?: string; // cursor (messageId)
  limit?: number;
}

// Tipos de envio de mensagem
export type MessageContentType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "template"
  | "input_select";

// Parâmetros base para envio
export interface SendMessageParams {
  conversationId: string;
  content?: string;
  contentType?: MessageContentType;
  inReplyTo?: string;  // ID da mensagem sendo respondida
}

// Parâmetros para envio de texto
export interface SendTextParams extends SendMessageParams {
  content: string;
  contentType?: "text";
}

// Parâmetros para envio de mídia
export interface SendMediaParams extends SendMessageParams {
  contentType: "image" | "video" | "audio" | "document";
  attachment: {
    fileUrl: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  };
}

// Parâmetros para envio de template
export interface SendTemplateParams extends SendMessageParams {
  contentType: "template";
  template: {
    name: string;
    languageCode: string;
    components: TemplateComponent[];
  };
}

// Componente de template para ENVIO (formato da API de envio)
export interface TemplateComponent {
  type: "header" | "body" | "button";
  parameters?: TemplateParameter[];
  sub_type?: string;
  index?: number;
}

export interface TemplateParameter {
  type: "text" | "image" | "video" | "document" | "coupon_code";
  text?: string;
  parameter_name?: string;
  image?: { link: string };
  video?: { link: string };
  document?: { link: string; filename?: string };
  coupon_code?: string; // Para botões COPY_CODE (igual ao Chatwoot)
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES DO WHATSAPP (formato da API de listagem)
// ─────────────────────────────────────────────────────────────────────────────

export interface WhatsAppTemplateComponentButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE";
  text: string;
  url?: string;
  phone_number?: string;
}

export interface WhatsAppTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  text?: string;
  buttons?: WhatsAppTemplateComponentButton[];
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
  };
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "DISABLED" | "IN_APPEAL" | "PENDING_DELETION";
  category: string;
  language: string;
  parameter_format?: "POSITIONAL" | "NAMED";
  components: WhatsAppTemplateComponent[];
}

// Respostas da API de templates (igual ao Chatwoot)
export interface ListTemplatesResponse {
  templates: WhatsAppTemplate[];
  lastUpdatedAt: string | null; // ISO string
}

export interface SyncTemplatesResponse {
  success: boolean;
  templatesCount: number;
  updatedAt: string; // ISO string
}

// Tipo união para todos os tipos de envio
export type SendMessageInput = SendTextParams | SendMediaParams | SendTemplateParams;

// ─────────────────────────────────────────────────────────────────────────────
// RESPOSTAS
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversationCounts {
  mine: number;
  unassigned: number;
  all: number;
  open?: number;
  resolved?: number;
}

/** Contagens por status para uma inbox específica */
export interface StatusCounts {
  open: number;
  waiting: number;
  resolved: number;
}

export interface ConversationsResponse {
  conversations: Conversation[];
  counts: ConversationCounts;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateConversationPayload {
  inboxId: string;
  phoneNumber: string;
  contactName?: string;
}

export interface CreateConversationResult {
  created: boolean;
  exists: boolean;
  conversationId?: string;
}

export interface CreateClientConversationResult {
  conversationId: string;
  isNew: boolean;
}

export interface LatestClientConversationResult {
  conversation: {
    conversationId: string;
    inboxId: string;
    lastActivityAt: string | null;
  } | null;
}

type ConversationWrappedResponse = { conversation: Conversation }
type ResolveWrappedResponse = { conversation: Conversation; wasAlreadyResolved?: boolean }

export interface ClientConversationSummary {
  clientId: number;
  conversationId: string;
  inboxId: string;
  lastActivityAt: string | null;
  waitingSince: string | null;
  agentLastSeenAt: string | null;
  status: string;
  unreadCount: number;
  lastMessage: {
    id: string;
    content: string | null;
    contentType: string;
    messageType: string;
    createdAt: string;
  } | null;
}

export interface ClientConversationSummariesResponse {
  summaries: ClientConversationSummary[];
}

export interface MessagesResponse {
  data: Message[];
  meta: {
    hasMore: boolean;
    oldestId?: string;  // cursor para próximo ?before=
  };
}

export interface SendMessageResponse {
  message: Message;
  queued: boolean;
}

// Resposta bruta do backend
interface MessagesApiResponse {
  messages: Message[];
  meta: {
    hasMore: boolean;
    oldestCursor?: string;
    newestCursor?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API CLIENT
// ─────────────────────────────────────────────────────────────────────────────

class ChatAPI {
  private baseUrl = "/api/chat";

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVERSATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async listConversations(
    params: ListConversationsParams = {}
  ): Promise<ConversationsResponse> {
    const searchParams = new URLSearchParams();

    if (params.assignee) searchParams.set("assignee", params.assignee);
    if (params.status) searchParams.set("status", params.status);
    if (params.inboxId) searchParams.set("inbox", params.inboxId);
    if (params.assigneeId) searchParams.set("assigneeId", params.assigneeId);
    if (params.waiting !== undefined) searchParams.set("waiting", String(params.waiting));
    if (params.sortBy) searchParams.set("sort", params.sortBy);
    if (params.sortOrder) searchParams.set("order", params.sortOrder);
    if (params.page) searchParams.set("page", String(params.page));
    if (params.limit) searchParams.set("limit", String(params.limit));

    const query = searchParams.toString();
    return this.request<ConversationsResponse>(
      `/conversations${query ? `?${query}` : ""}`
    );
  }

  async getConversation(id: string): Promise<Conversation> {
    return this.request<Conversation>(`/conversations/${id}`);
  }

  async createConversationIfNotExists(
    payload: CreateConversationPayload
  ): Promise<CreateConversationResult> {
    return this.request<CreateConversationResult>("/conversations/new", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async createClientConversation(
    clientId: number,
    payload: { inboxId: string; phoneNumber: string; contactName?: string }
  ): Promise<CreateClientConversationResult> {
    return this.request<CreateClientConversationResult>(`/clients/${clientId}/conversation`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getLatestClientConversation(clientId: number): Promise<LatestClientConversationResult> {
    return this.request<LatestClientConversationResult>(`/clients/${clientId}/conversation/latest`);
  }

  async listClientConversationSummaries(clientIds: number[]): Promise<ClientConversationSummariesResponse> {
    return this.request<ClientConversationSummariesResponse>(`/conversations/by-clients`, {
      method: "POST",
      body: JSON.stringify({ clientIds }),
    });
  }

  async getConversationClients(conversationId: string): Promise<{ clientIds: number[] }> {
    return this.request<{ clientIds: number[] }>(`/conversations/${conversationId}/clients`);
  }

  async resolveConversation(id: string): Promise<Conversation> {
    const response = await this.request<ResolveWrappedResponse | Conversation>(`/conversations/${id}/resolve`, {
      method: "POST",
    });
    return "conversation" in (response as any) ? (response as ResolveWrappedResponse).conversation : (response as Conversation)
  }

  async assignConversation(
    id: string,
    assigneeId: string | null
  ): Promise<Conversation> {
    const response = await this.request<ConversationWrappedResponse | Conversation>(`/conversations/${id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ assigneeId }),
    });
    return "conversation" in (response as any) ? (response as ConversationWrappedResponse).conversation : (response as Conversation)
  }

  async updateLastSeen(id: string): Promise<void> {
    await this.request(`/conversations/${id}/update_last_seen`, {
      method: "POST",
    });
  }

  async clearConversationMessages(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/conversations/${id}/clear`, {
      method: "POST",
    });
  }

  async associateClientToConversation(
    conversationId: string,
    params: { cnpj?: string; clientId?: number }
  ): Promise<Conversation> {
    return this.request<Conversation>(`/conversations/${conversationId}/associate-client`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async unassociateClientFromConversation(conversationId: string, clientId: number): Promise<{ success: boolean; deleted: number }> {
    return this.request<{ success: boolean; deleted: number }>(`/conversations/${conversationId}/clients/${clientId}`, {
      method: "DELETE",
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════

  async listMessages(
    conversationId: string,
    params: ListMessagesParams = {}
  ): Promise<MessagesResponse> {
    const searchParams = new URLSearchParams();

    if (params.before) searchParams.set("before", params.before);
    if (params.limit) searchParams.set("limit", String(params.limit));

    const query = searchParams.toString();
    const response = await this.request<MessagesApiResponse>(
      `/conversations/${conversationId}/messages${query ? `?${query}` : ""}`
    );

    // Mapear resposta do backend para o formato esperado pelo frontend
    return {
      data: response.messages,
      meta: {
        hasMore: response.meta.hasMore,
        oldestId: response.meta.oldestCursor,  // cursor para próximo ?before=
      },
    };
  }

  /**
   * Envia uma mensagem para uma conversa
   * Suporta: texto, mídia, template
   */
  async sendMessage(params: SendMessageInput): Promise<SendMessageResponse> {
    // Construir payload para o backend
    const payload: Record<string, unknown> = {
      conversationId: params.conversationId,
      content: params.content,
      contentType: params.contentType || "text",
    };

    // Adicionar inReplyTo se presente
    if (params.inReplyTo) {
      payload.contentAttributes = { inReplyTo: params.inReplyTo };
    }

    // Adicionar attachment se for mídia
    if ("attachment" in params && params.attachment) {
      payload.attachments = [{
        fileType: params.contentType,
        fileUrl: params.attachment.fileUrl,
        fileName: params.attachment.fileName,
        fileSize: params.attachment.fileSize,
        mimeType: params.attachment.mimeType,
      }];
    }

    // Adicionar template se for template
    if ("template" in params && params.template) {
      payload.contentAttributes = {
        ...((payload.contentAttributes as Record<string, unknown>) || {}),
        template: params.template,
      };
    }

    return this.request<SendMessageResponse>("/messages", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INBOXES
  // ═══════════════════════════════════════════════════════════════════════════

  async listInboxes(): Promise<Inbox[]> {
    const response = await this.request<{ inboxes: Inbox[] }>("/inboxes");
    return response.inboxes;
  }

  async listConversationAssignees(conversationId: string): Promise<ChatAssigneeUser[]> {
    const response = await this.request<{ users: ChatAssigneeUser[] }>(
      `/conversations/${conversationId}/assignees`,
    )
    return response.users
  }

  /**
   * Busca contagens de conversas por status para uma inbox.
   * @param inboxId ID da inbox
   * @param assignee Filtro de assignee: 'me' | 'all'
   */
  async getStatusCounts(
    inboxId: string,
    assignee: "me" | "all" = "me",
    assigneeId?: string
  ): Promise<StatusCounts> {
    const searchParams = new URLSearchParams();
    searchParams.set("inbox", inboxId);
    searchParams.set("assignee", assignee);
    if (assigneeId) searchParams.set("assigneeId", assigneeId);
    return this.request<StatusCounts>(`/conversations/counts?${searchParams.toString()}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lista templates armazenados no banco (igual ao Chatwoot)
   */
  async listTemplates(inboxId: string): Promise<ListTemplatesResponse> {
    return this.request<ListTemplatesResponse>(`/inboxes/${inboxId}/templates`);
  }

  /**
   * Sincroniza templates com a API do WhatsApp Business Manager (igual ao Chatwoot)
   */
  async syncTemplates(inboxId: string): Promise<SyncTemplatesResponse> {
    return this.request<SyncTemplatesResponse>(`/inboxes/${inboxId}/templates/sync`, {
      method: "POST",
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTACHMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  async getAttachmentUrl(id: string): Promise<AttachmentUrlResponse> {
    return this.request<AttachmentUrlResponse>(`/attachments/${id}`);
  }

  /**
   * Upload de arquivo para o chat (igual ao Chatwoot DirectUpload)
   */
  async uploadFile(file: File, conversationId?: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    if (conversationId) {
      formData.append("conversationId", conversationId);
    }

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(error.error || "Upload failed");
    }

    return response.json();
  }

  async saveContactAsSindico(clientId: number, data: { name: string; phone: string }): Promise<{ success: boolean }> {
    const response = await fetch(`/api/clients/${clientId}/save-as-sindico`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Erro ao salvar síndico");
    }
    return response.json();
  }
}

// Resposta do upload
export interface UploadResponse {
  success: boolean;
  attachment: {
    url: string;        // URL HTTP pública (assinada) - pronta para usar
    fileName: string;
    fileType: string;
    fileSize: number;
    mimeType: string;
  };
}

// Resposta do endpoint de attachment
export interface AttachmentUrlResponse {
  id: string;
  status: "pending" | "downloading" | "completed" | "failed";
  url: string | null;
  fileName?: string;
  fileType?: string;
  mimeType?: string;
  fileSize?: number;
  message?: string;
}

// Cache de URLs assinadas (para não fazer request repetida)
const attachmentUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Busca URL assinada para um attachment (com cache de 50 minutos)
 */
export async function getSignedAttachmentUrl(attachmentId: string): Promise<string | null> {
  // Verificar cache
  const cached = attachmentUrlCache.get(attachmentId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const response = await chatAPI.getAttachmentUrl(attachmentId);

    if (response.status === "completed" && response.url) {
      // Cachear por 50 minutos (URL expira em 60 min)
      attachmentUrlCache.set(attachmentId, {
        url: response.url,
        expiresAt: Date.now() + 50 * 60 * 1000,
      });
      return response.url;
    }

    return null;
  } catch (error) {
    console.error(`[getSignedAttachmentUrl] Error for ${attachmentId}:`, error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSCA DE CONTATOS
// ─────────────────────────────────────────────────────────────────────────────

export interface ContactSearchResult {
  contactId: string;
  contactName: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  associatedClients: Array<{
    clientId: number;
    razaoSocial: string;
  }>;
}

export interface SearchContactsResponse {
  contacts: ContactSearchResult[];
  hasMore: boolean;
  total: number;
}

export async function searchContacts(params: {
  query: string;
  inboxId: string;
  page?: number;
  pageSize?: number;
}): Promise<SearchContactsResponse> {
  const searchParams = new URLSearchParams({
    query: params.query,
    inboxId: params.inboxId,
    page: String(params.page || 1),
    pageSize: String(params.pageSize || 30),
  });

  const response = await fetch(`/api/chat/contacts/search?${searchParams}`);
  if (!response.ok) {
    throw new Error('Erro ao buscar contatos');
  }
  return response.json();
}

// Singleton
export const chatAPI = new ChatAPI();

