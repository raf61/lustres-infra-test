"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useSession } from "next-auth/react";
import { useChatSocket, ChatSocketMessage, ChatSocketConversation } from "./socket";
import {
  chatAPI,
  Conversation,
  Message,
  Inbox,
  ListConversationsParams,
  SendTextParams,
  StatusCounts,
  TemplateComponent,
} from "./api";

// ════════════════════════════════════════════════════════════════════════════
// ERROS CUSTOMIZADOS
// ════════════════════════════════════════════════════════════════════════════

export class ChatError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "ChatError";
  }
}

export class OutOfWindowError extends ChatError {
  constructor() {
    super(
      "Janela de 24 horas expirada. Envie um template ou aguarde o cliente responder.",
      "OUT_OF_24H_WINDOW",
      403
    );
    this.name = "OutOfWindowError";
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TIPOS DO ESTADO
// ════════════════════════════════════════════════════════════════════════════

export interface ChatFilters {
  assignee: "me" | "all";              // Minhas | Todas
  status: "open" | "waiting" | "resolved";  // Abertas | Esperando | Resolvidas
  inboxId?: string;                    // Filtrar por inbox
  assigneeId?: string | null;          // Filtrar por assignee específico (somente em "Todas")
}

interface ChatState {
  // Conexão
  isConnected: boolean;
  isConnecting: boolean;
  socketError: Error | null;

  // Dados
  conversations: Conversation[];
  messages: Record<string, Message[]>; // conversationId -> messages
  inboxes: Inbox[];

  // UI State
  activeConversationId: string | null;
  activeConversationDetails: Conversation | null;
  filters: ChatFilters;
  replyToMessageId: string | null;

  // Contagens por status (atualizadas em tempo real)
  statusCounts: StatusCounts;
  isLoadingCounts: boolean;

  // Loading states
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;

  // Pagination
  conversationsMeta: {
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  };
  messagesMeta: Record<string, { hasMore: boolean; oldestId?: string }>;

  // Sync
  lastSyncAt: number | null;
}

// ════════════════════════════════════════════════════════════════════════════
// ACTIONS
// ════════════════════════════════════════════════════════════════════════════

type ChatAction =
  // Conexão
  | { type: "SET_CONNECTION"; payload: { isConnected: boolean; isConnecting: boolean; error: Error | null } }

  // Conversas
  | { type: "SET_CONVERSATIONS"; payload: { conversations: Conversation[]; meta: ChatState["conversationsMeta"] } }
  | { type: "APPEND_CONVERSATIONS"; payload: { conversations: Conversation[]; meta: ChatState["conversationsMeta"] } }
  | { type: "UPDATE_CONVERSATION"; payload: Partial<Conversation> & { id: string } }
  | { type: "ADD_CONVERSATION"; payload: Conversation }
  | { type: "REMOVE_CONVERSATION"; payload: string }

  // Mensagens
  | { type: "SET_MESSAGES"; payload: { conversationId: string; messages: Message[]; meta: { hasMore: boolean; oldestId?: string } } }
  | { type: "PREPEND_MESSAGES"; payload: { conversationId: string; messages: Message[]; meta: { hasMore: boolean; oldestId?: string } } }
  | {
    type: "ADD_MESSAGE"; payload: {
      message: Message;
      conversationUpdate?: {
        lastActivityAt?: string;
        status?: string;
        waitingSince?: string | null;
        unreadCount?: number;  // ← Backend envia o unreadCount calculado
        canReply?: boolean;    // ← Backend envia se pode responder (janela 24h)
      }
    }
  }
  | { type: "UPDATE_MESSAGE"; payload: Partial<Message> & { id: string; conversationId: string; attachment?: { id: string; downloadStatus: string } } }

  // Inboxes
  | { type: "SET_INBOXES"; payload: Inbox[] }

  // UI
  | { type: "SET_ACTIVE_CONVERSATION"; payload: string | null }
  | { type: "SET_ACTIVE_CONVERSATION_DETAILS"; payload: Conversation | null }
  | { type: "SET_FILTERS"; payload: Partial<ChatFilters> }

  // Loading
  | { type: "SET_LOADING_CONVERSATIONS"; payload: boolean }
  | { type: "SET_LOADING_MESSAGES"; payload: boolean }
  | { type: "SET_SENDING_MESSAGE"; payload: boolean }
  | { type: "SET_REPLY_TO_MESSAGE"; payload: string | null }

  // Contagens
  | { type: "SET_STATUS_COUNTS"; payload: StatusCounts }
  | { type: "SET_LOADING_COUNTS"; payload: boolean }
  | { type: "INCREMENT_STATUS_COUNT"; payload: { status: keyof StatusCounts; delta: number } }

  // Sync
  | { type: "SET_LAST_SYNC"; payload: number };

// ════════════════════════════════════════════════════════════════════════════
// REDUCER
// ════════════════════════════════════════════════════════════════════════════

const initialState: ChatState = {
  isConnected: false,
  isConnecting: false,
  socketError: null,
  conversations: [],
  messages: {},
  inboxes: [],
  activeConversationId: null,
  activeConversationDetails: null,
  filters: { assignee: "me", status: "open" },  // Padrão: Minhas + Abertas
  replyToMessageId: null,
  statusCounts: { open: 0, waiting: 0, resolved: 0 },
  isLoadingCounts: false,
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSendingMessage: false,
  conversationsMeta: { total: 0, page: 1, totalPages: 1, hasMore: false },
  messagesMeta: {},
  lastSyncAt: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    // ─────────────────────────────────────────────────────────────────────────
    // CONEXÃO
    // ─────────────────────────────────────────────────────────────────────────
    case "SET_CONNECTION":
      return {
        ...state,
        isConnected: action.payload.isConnected,
        isConnecting: action.payload.isConnecting,
        socketError: action.payload.error,
      };

    // ─────────────────────────────────────────────────────────────────────────
    // CONVERSAS
    // ─────────────────────────────────────────────────────────────────────────
    case "SET_CONVERSATIONS":
      return {
        ...state,
        conversations: action.payload.conversations,
        conversationsMeta: action.payload.meta,
        isLoadingConversations: false,
      };

    case "APPEND_CONVERSATIONS":
      return {
        ...state,
        conversations: [...state.conversations, ...action.payload.conversations],
        conversationsMeta: action.payload.meta,
        isLoadingConversations: false,
      };

    case "UPDATE_CONVERSATION": {
      const { id, ...updates } = action.payload;
      return {
        ...state,
        conversations: state.conversations.map((conv) =>
          conv.id === id ? { ...conv, ...updates } : conv
        ),
      };
    }

    case "ADD_CONVERSATION": {
      // Adiciona no início (mais recente)
      const exists = state.conversations.some((c) => c.id === action.payload.id);
      if (exists) return state;
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
        conversationsMeta: {
          ...state.conversationsMeta,
          total: state.conversationsMeta.total + 1,
        },
      };
    }

    case "REMOVE_CONVERSATION": {
      const filtered = state.conversations.filter((c) => c.id !== action.payload);
      if (filtered.length === state.conversations.length) return state; // Não existia
      return {
        ...state,
        conversations: filtered,
        conversationsMeta: {
          ...state.conversationsMeta,
          total: Math.max(0, state.conversationsMeta.total - 1),
        },
        // Se a conversa removida era a ativa, limpa a seleção
        activeConversationId: state.activeConversationId === action.payload ? null : state.activeConversationId,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MENSAGENS
    // ─────────────────────────────────────────────────────────────────────────
    case "SET_MESSAGES":
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.conversationId]: action.payload.messages,
        },
        messagesMeta: {
          ...state.messagesMeta,
          [action.payload.conversationId]: action.payload.meta,
        },
        isLoadingMessages: false,
      };

    case "PREPEND_MESSAGES": {
      const existing = state.messages[action.payload.conversationId] || [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.conversationId]: [
            ...action.payload.messages,
            ...existing,
          ],
        },
        messagesMeta: {
          ...state.messagesMeta,
          [action.payload.conversationId]: action.payload.meta,
        },
        isLoadingMessages: false,
      };
    }

    case "ADD_MESSAGE": {
      const { message, conversationUpdate } = action.payload;
      const convId = message.conversationId;
      const existing = state.messages[convId] || [];

      // Se já existe, atualiza (mescla) para garantir que recebemos dados novos (ex: content pós-processamento)
      const messageIndex = existing.findIndex((m) => m.id === message.id);
      let newMessages;
      if (messageIndex > -1) {
        // BUGFIX: Ordem de merge importa! Se a mensagem já existe (UPDATE chegou antes do CREATE), 
        // mantemos o status mais avançado.
        const existingMsg = existing[messageIndex];
        const statusPriority: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };
        const shouldKeepOldStatus = statusPriority[existingMsg.status] > statusPriority[message.status];

        newMessages = [...existing];
        newMessages[messageIndex] = {
          ...existingMsg,
          ...message,
          status: shouldKeepOldStatus ? existingMsg.status : message.status
        };
      } else {
        // Adiciona no final (mais recente)
        newMessages = [...existing, message];
      }

      // Atualiza lastMessage, lastActivityAt, unreadCount e canReply na conversa
      // Usa valores do servidor (igual ao Chatwoot) se disponíveis
      const updatedConversations = state.conversations.map((conv) => {
        if (conv.id === convId) {
          // Se a conversa está ativa (selecionada), não incrementa unreadCount
          const isActive = state.activeConversationId === convId;

          // BUGFIX: Pegar a mensagem já mesclada do array (que pode ter status mais novo de um UPDATE_MESSAGE que chegou antes)
          const mergedMessage = newMessages.find(m => m.id === message.id) || message;

          return {
            ...conv,
            lastMessage: mergedMessage,
            lastActivityAt: conversationUpdate?.lastActivityAt || message.createdAt,
            // unreadCount: usa o valor do servidor, mas se a conversa está ativa, mantém 0
            unreadCount: isActive ? 0 : (conversationUpdate?.unreadCount ?? conv.unreadCount ?? 0),
            // canReply: atualiza se o backend enviar (libera janela de 24h automaticamente)
            ...(conversationUpdate?.canReply !== undefined && { canReply: conversationUpdate.canReply }),
            // Também atualiza outros campos se disponíveis
            ...(conversationUpdate?.status && { status: conversationUpdate.status as Conversation["status"] }),
            ...(conversationUpdate?.waitingSince !== undefined && { waitingSince: conversationUpdate.waitingSince }),
          };
        }
        return conv;
      });

      // Ordena conversas por lastActivityAt (mais recente primeiro) - igual ao Chatwoot
      updatedConversations.sort((a, b) => {
        const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        return bTime - aTime;
      });

      return {
        ...state,
        messages: {
          ...state.messages,
          [convId]: newMessages,
        },
        conversations: updatedConversations,
      };
    }

    case "UPDATE_MESSAGE": {
      const { id, conversationId, attachment, ...updates } = action.payload;
      const msgs = state.messages[conversationId] || [];
      const updatedConversations = state.conversations.map((conv) => {
        if (conv.id !== conversationId) return conv;
        if (conv.lastMessage?.id !== id) return conv;
        return {
          ...conv,
          lastMessage: {
            ...conv.lastMessage,
            ...updates,
          },
        };
      });
      return {
        ...state,
        messages: {
          ...state.messages,
          [conversationId]: msgs.map((msg) => {
            if (msg.id !== id) return msg;

            // Se tem attachment update, atualizar no array de attachments
            if (attachment && msg.attachments) {
              const updatedAttachments = msg.attachments.map((att) =>
                att.id === attachment.id
                  ? { ...att, downloadStatus: attachment.downloadStatus as any }
                  : att
              );
              return { ...msg, ...updates, attachments: updatedAttachments };
            }

            return { ...msg, ...updates };
          }),
        },
        conversations: updatedConversations,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INBOXES
    // ─────────────────────────────────────────────────────────────────────────
    case "SET_INBOXES": {
      const inboxes = action.payload;
      // Se não tem inboxId selecionada, seleciona a primeira automaticamente
      const shouldSelectFirst = !state.filters.inboxId && inboxes.length > 0;
      return {
        ...state,
        inboxes,
        filters: shouldSelectFirst
          ? { ...state.filters, inboxId: inboxes[0].id }
          : state.filters,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────────────────────────────────
    case "SET_ACTIVE_CONVERSATION":
      return { ...state, activeConversationId: action.payload };

    case "SET_ACTIVE_CONVERSATION_DETAILS":
      return { ...state, activeConversationDetails: action.payload };

    case "SET_FILTERS": {
      const newFilters = { ...state.filters, ...action.payload };

      // Se o inboxId mudou, limpa a conversa ativa e as mensagens
      const inboxChanged = action.payload.inboxId !== undefined &&
        action.payload.inboxId !== state.filters.inboxId;

      // Se o status ou assignee mudou, limpa a conversa ativa (pode não existir no novo filtro)
      const statusChanged = action.payload.status !== undefined &&
        action.payload.status !== state.filters.status;
      const assigneeChanged = action.payload.assignee !== undefined &&
        action.payload.assignee !== state.filters.assignee;
      const assigneeIdChanged = action.payload.assigneeId !== undefined &&
        action.payload.assigneeId !== state.filters.assigneeId;

      const shouldClearActive = inboxChanged || statusChanged || assigneeChanged || assigneeIdChanged;

      return {
        ...state,
        filters: newFilters,
        // Limpa conversa ativa e mensagens quando filtros relevantes mudam
        ...(shouldClearActive && {
          activeConversationId: null,
          activeConversationDetails: null,
          conversations: [], // Limpa para evitar flash de dados antigos
        }),
        // Se inbox mudou, limpa também as mensagens em cache
        ...(inboxChanged && { messages: {} }),
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOADING
    // ─────────────────────────────────────────────────────────────────────────
    case "SET_LOADING_CONVERSATIONS":
      return { ...state, isLoadingConversations: action.payload };

    case "SET_LOADING_MESSAGES":
      return { ...state, isLoadingMessages: action.payload };

    case "SET_SENDING_MESSAGE":
      return { ...state, isSendingMessage: action.payload };
    case "SET_REPLY_TO_MESSAGE":
      return { ...state, replyToMessageId: action.payload };

    // ─────────────────────────────────────────────────────────────────────────
    // CONTAGENS
    // ─────────────────────────────────────────────────────────────────────────
    case "SET_STATUS_COUNTS":
      return { ...state, statusCounts: action.payload, isLoadingCounts: false };

    case "SET_LOADING_COUNTS":
      return { ...state, isLoadingCounts: action.payload };

    case "INCREMENT_STATUS_COUNT": {
      const { status, delta } = action.payload;
      return {
        ...state,
        statusCounts: {
          ...state.statusCounts,
          [status]: Math.max(0, state.statusCounts[status] + delta),
        },
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SYNC
    // ─────────────────────────────────────────────────────────────────────────
    case "SET_LAST_SYNC":
      return { ...state, lastSyncAt: action.payload };

    default:
      return state;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ════════════════════════════════════════════════════════════════════════════

interface ChatContextValue {
  state: ChatState;

  // Ações de Conversa
  loadConversations: (params?: ListConversationsParams) => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  selectConversation: (id: string | null) => void;
  openConversationById: (id: string) => Promise<void>;
  resolveConversation: (id: string) => Promise<void>;
  assignConversation: (id: string, assigneeId: string | null) => Promise<void>;
  associateClientToConversation: (
    conversationId: string,
    params: { cnpj?: string; clientId?: number }
  ) => Promise<Conversation | undefined>;
  unassociateClientFromConversation: (conversationId: string, clientId: number) => Promise<void>;
  clearConversationMessages: (id: string) => Promise<void>;

  // Ações de Mensagem
  loadMessages: (conversationId: string) => Promise<void>;
  loadMoreMessages: (conversationId: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    content: string,
    options?: { inReplyTo?: string }
  ) => Promise<Message | undefined>;
  sendMessageWithAttachment: (
    conversationId: string,
    options: {
      content?: string;
      inReplyTo?: string;
      attachment: {
        fileType: string;
        fileUrl: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
      };
    }
  ) => Promise<Message | undefined>;
  sendTemplate: (
    conversationId: string,
    template: {
      name: string;
      languageCode: string;
      components: TemplateComponent[];
    }
  ) => Promise<Message | undefined>;

  // Ações de Filtro
  setFilters: (filters: Partial<ChatFilters>) => void;
  setReplyToMessageId: (id: string | null) => void;
  clearReplyToMessage: () => void;

  // Inboxes
  loadInboxes: () => Promise<void>;

  // Contagens
  loadStatusCounts: () => Promise<void>;

  // Computed
  activeConversation: Conversation | null;
  activeMessages: Message[];
  replyToMessageId: string | null;
  statusCounts: StatusCounts;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ════════════════════════════════════════════════════════════════════════════

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const loadingRef = useRef({ conversations: false, messages: new Set<string>() });
  const { data: session } = useSession();
  const currentUserId = session?.user?.id as string | undefined;

  // Ref para função de reload de contagens (evita dependência circular nos handlers)
  const reloadCountsRef = useRef<() => void>(() => { });
  const conversationsRequestRef = useRef(0);
  const loadMoreRequestRef = useRef(0);
  const countsRequestRef = useRef(0);
  const filtersRef = useRef<ChatFilters>(initialState.filters);
  const conversationsInFlightKeyRef = useRef<string | null>(null);
  const countsInFlightKeyRef = useRef<string | null>(null);
  const lastConversationsRequestTypeRef = useRef<"list" | "more" | null>(null);
  const conversationsRef = useRef(state.conversations);
  const inboxesLoadedRef = useRef(false);
  const openConversationInFlightRef = useRef<Set<string>>(new Set());
  const conversationFetchInFlightRef = useRef<Set<string>>(new Set());
  const lastSeenUpdatedRef = useRef<Record<string, number>>({});
  const activeConversationIdRef = useRef<string | null>(state.activeConversationId);
  const activeConversationDetailsRef = useRef<Conversation | null>(state.activeConversationDetails);

  // ─────────────────────────────────────────────────────────────────────────
  // WEBSOCKET HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleMessageCreated = useCallback((data: ChatSocketMessage) => {
    console.log("[Chat] WebSocket message.created received:", data);

    // Mapear attachments do backend para o formato do frontend
    const attachments = data.attachments?.map((att) => ({
      id: att.id,
      fileType: att.fileType,
      fileName: att.fileName,
      mimeType: att.mimeType,
      downloadStatus: att.downloadStatus,
    }));

    const message: Message = {
      id: data.id,
      conversationId: data.conversationId,
      content: data.content,
      contentType: data.contentType,
      messageType: data.messageType,
      status: data.status,
      timestamp: data.createdAt || data.timestamp || null,
      createdAt: data.createdAt || data.timestamp || new Date().toISOString(),
      attachments,
      contentAttributes: data.contentAttributes,
    };

    // Extrai dados da conversa do payload
    const conversationUpdate = data.conversation ? {
      lastActivityAt: data.conversation.lastActivityAt,
      status: data.conversation.status,
      waitingSince: data.conversation.waitingSince,
      unreadCount: data.conversation.unreadCount,
      canReply: data.conversation.canReply,
    } : undefined;

    // Verifica se a conversa existe na lista atual
    const conversationExists = state.conversations.some((c) => c.id === data.conversationId);

    const hasCompleteConversationSnapshot =
      data.conversation &&
      Object.prototype.hasOwnProperty.call(data.conversation, "status") &&
      Object.prototype.hasOwnProperty.call(data.conversation, "waitingSince") &&
      Object.prototype.hasOwnProperty.call(data.conversation, "assigneeId");

    // Se a conversa não existe na lista, verifica se deveria aparecer baseado nos filtros
    if (!conversationExists && data.conversation && data.inboxId && hasCompleteConversationSnapshot) {
      const isActiveConversation =
        activeConversationIdRef.current === data.conversationId ||
        activeConversationDetailsRef.current?.id === data.conversationId;
      if (isActiveConversation) {
        // Conversa já aberta no painel (details), não precisa refetch para lista
        dispatch({
          type: "UPDATE_CONVERSATION",
          payload: {
            id: data.conversationId,
            ...(conversationUpdate?.status && { status: conversationUpdate.status as Conversation["status"] }),
            ...(conversationUpdate?.waitingSince !== undefined && { waitingSince: conversationUpdate.waitingSince }),
            ...(conversationUpdate?.canReply !== undefined && { canReply: conversationUpdate.canReply }),
          },
        });
        const currentDetails = activeConversationDetailsRef.current;
        if (currentDetails) {
          dispatch({
            type: "SET_ACTIVE_CONVERSATION_DETAILS",
            payload: {
              ...currentDetails,
              ...(conversationUpdate?.status && { status: conversationUpdate.status as Conversation["status"] }),
              ...(conversationUpdate?.waitingSince !== undefined && { waitingSince: conversationUpdate.waitingSince }),
              ...(conversationUpdate?.canReply !== undefined && { canReply: conversationUpdate.canReply }),
              ...(conversationUpdate?.lastActivityAt && { lastActivityAt: conversationUpdate.lastActivityAt }),
              ...(conversationUpdate?.unreadCount !== undefined && { unreadCount: conversationUpdate.unreadCount }),
            },
          });
        }
      } else {
        const { filters } = state;

        // Verifica se é da inbox correta
        const inboxMatches = !filters.inboxId || filters.inboxId === data.inboxId;

        if (inboxMatches) {
          const conversationAssigneeId =
            (data.conversation as { assigneeId?: string | null } | undefined)?.assigneeId;
          const assigneeMatches =
            filters.assignee === "all"
              ? !filters.assigneeId || conversationAssigneeId === filters.assigneeId
              : currentUserId && conversationAssigneeId === currentUserId;

          // Verifica se o status corresponde ao filtro atual
          const convStatus = data.conversation.status;
          const convWaitingSince = data.conversation.waitingSince;

          let statusMatches = false;
          if (filters.status === "open") {
            // Aba "Abertas" inclui tudo que é open (inclui waiting)
            statusMatches = convStatus === "open";
          } else if (filters.status === "waiting") {
            // Aba "Esperando" = open + waitingSince não null
            statusMatches = convStatus === "open" && !!convWaitingSince;
          } else if (filters.status === "resolved") {
            statusMatches = convStatus === "resolved";
          }

          // Se deveria aparecer, busca a conversa completa e adiciona
          if (statusMatches && assigneeMatches) {
            console.log("[Chat] Conversation matches current filter, fetching full data:", data.conversationId);
            fetchConversationDetails(data.conversationId).then((conversation) => {
              if (conversation) {
                dispatch({ type: "ADD_CONVERSATION", payload: conversation });
              }
            });
          }
        }
      }
    }

    if (!conversationExists && (!data.conversation || !data.inboxId || !hasCompleteConversationSnapshot)) {
      fetchConversationDetails(data.conversationId).then((conversation) => {
        if (!conversation) return;
        const { filters } = state;
        const inboxMatches = !filters.inboxId || filters.inboxId === conversation.inboxId;
        const assigneeMatches =
          filters.assignee === "all"
            ? !filters.assigneeId || conversation.assigneeId === filters.assigneeId
            : currentUserId && conversation.assigneeId === currentUserId;
        let statusMatches = false;
        if (filters.status === "open") {
          statusMatches = conversation.status === "open";
        } else if (filters.status === "waiting") {
          statusMatches = conversation.status === "open" && !!conversation.waitingSince;
        } else if (filters.status === "resolved") {
          statusMatches = conversation.status === "resolved";
        }
        if (inboxMatches && assigneeMatches && statusMatches) {
          dispatch({ type: "ADD_CONVERSATION", payload: conversation });
        }
      });
    }

    console.log("[Chat] Dispatching ADD_MESSAGE:", { message, conversationUpdate });

    dispatch({
      type: "ADD_MESSAGE",
      payload: { message, conversationUpdate }
    });

    // Se a mensagem é da conversa ativa E é incoming, atualizar lastSeen no backend
    if (state.activeConversationId === data.conversationId && data.messageType === "incoming") {
      chatAPI.updateLastSeen(data.conversationId).catch(console.error);
    }

    // Recarregar contagens quando uma mensagem chega (pode mudar status/waitingSince)
    // Isso garante que as contagens nas 3 abas estejam sempre atualizadas em tempo real
    if (data.inboxId && (!state.filters.inboxId || state.filters.inboxId === data.inboxId)) {
      reloadCountsRef.current();
    }
  }, [state.activeConversationId, state.conversations, state.filters, currentUserId]);

  const handleMessageUpdated = useCallback((data: ChatSocketMessage) => {
    dispatch({
      type: "UPDATE_MESSAGE",
      payload: {
        id: data.id,
        conversationId: data.conversationId,
        status: data.status,
        externalError: data.externalError,  // ← Erro do provedor
        attachment: data.attachment,  // ← Atualização de download
      },
    });
  }, []);

  const handleConversationCreated = useCallback((data: ChatSocketConversation) => {
    // Verifica se a conversa é da inbox atualmente selecionada
    // Se não for, ignora (igual ao Chatwoot)
    const currentInboxId = state.filters.inboxId;
    if (currentInboxId && data.inboxId && data.inboxId !== currentInboxId) {
      console.log(`[Chat] Ignoring conversation.created - inbox mismatch (${data.inboxId} != ${currentInboxId})`);
      return;
    }

    const isActiveConversation =
      activeConversationIdRef.current === data.id ||
      activeConversationDetailsRef.current?.id === data.id;
    if (isActiveConversation) {
      return;
    }

    // Busca a conversa completa da API e adiciona
    fetchConversationDetails(data.id).then((conversation) => {
      if (!conversation) return;
      // Verifica novamente com dados completos
      if (currentInboxId && conversation.inboxId !== currentInboxId) {
        return;
      }
      if (
        state.filters.assignee === "me" &&
        currentUserId &&
        conversation.assigneeId !== currentUserId
      ) {
        return;
      }
      if (
        state.filters.assignee === "all" &&
        state.filters.assigneeId &&
        conversation.assigneeId !== state.filters.assigneeId
      ) {
        return;
      }
      dispatch({ type: "ADD_CONVERSATION", payload: conversation });
      // Recarregar contagens (nova conversa criada)
      reloadCountsRef.current();
    });
  }, [state.filters.inboxId, state.filters.assignee, currentUserId]);

  const handleConversationUpdated = useCallback((data: ChatSocketConversation) => {
    console.log("[Chat] WebSocket conversation.updated received:", data);

    const id = data.conversationId || data.id;
    const { filters } = state;

    // Verifica se a conversa existe na lista
    const conversationExists = state.conversations.some((c) => c.id === id);

    // Verifica se a conversa deveria estar na lista baseado nos filtros
    const inboxMatches = !filters.inboxId || filters.inboxId === data.inboxId;

    let statusMatches = false;
    if (inboxMatches) {
      const convStatus = data.status;
      const convWaitingSince = data.waitingSince;

      if (filters.status === "open") {
        // Aba "Abertas" inclui tudo que é open (inclui waiting)
        statusMatches = convStatus === "open";
      } else if (filters.status === "waiting") {
        statusMatches = convStatus === "open" && !!convWaitingSince;
      } else if (filters.status === "resolved") {
        statusMatches = convStatus === "resolved";
      }
    }
    const assigneeMatches =
      filters.assignee === "all"
        ? !filters.assigneeId || data.assigneeId === filters.assigneeId
        : currentUserId && data.assigneeId === currentUserId;

    // Se a conversa existe mas não deveria mais (mudou de filtro), remove
    // EXCETO se for a conversa ativa (não fecha a tela do chat enquanto o usuário está visualizando)
    if (conversationExists && !(statusMatches && assigneeMatches)) {
      const isActive = state.activeConversationId === id;
      if (!isActive) {
        console.log("[Chat] Conversation no longer matches filter, removing:", id);
        dispatch({ type: "REMOVE_CONVERSATION", payload: id });
      } else {
        console.log("[Chat] Conversation no longer matches filter but is active, keeping:", id);
        // Ainda atualiza os dados da conversa para refletir o novo status
        dispatch({
          type: "UPDATE_CONVERSATION",
          payload: {
            id,
            status: data.status as Conversation["status"],
            waitingSince: data.waitingSince,
            lastActivityAt: data.lastActivityAt,
            assigneeId: data.assigneeId,
            ...(data.canReply !== undefined && { canReply: data.canReply }),
          },
        });
      }
      // Recarregar contagens quando status/waitingSince muda (conversa saiu/entrou de aba)
      if (inboxMatches) {
        reloadCountsRef.current();
      }
      return;
    }

    // Se a conversa não existe mas deveria, adiciona
    if (!conversationExists && statusMatches && inboxMatches && assigneeMatches) {
      const isActiveConversation =
        activeConversationIdRef.current === id ||
        activeConversationDetailsRef.current?.id === id;
      if (isActiveConversation) {
        return;
      }
      console.log("[Chat] Conversation matches current filter, fetching full data:", id);
      fetchConversationDetails(id).then((conversation) => {
        if (conversation) {
          dispatch({ type: "ADD_CONVERSATION", payload: conversation });
          // Recarregar contagens (nova conversa apareceu)
          reloadCountsRef.current();
        }
      });
      return;
    }

    // Se a conversa existe e ainda corresponde ao filtro, atualiza
    if (conversationExists) {
      const isActive = state.activeConversationId === id;
      const unreadCount = isActive ? 0 : data.unreadCount;

      dispatch({
        type: "UPDATE_CONVERSATION",
        payload: {
          id,
          status: data.status as Conversation["status"],
          waitingSince: data.waitingSince,
          lastActivityAt: data.lastActivityAt,
          assigneeId: data.assigneeId,
          ...(unreadCount !== undefined && { unreadCount }),
          ...(data.canReply !== undefined && { canReply: data.canReply }),
        },
      });
    }
  }, [state.activeConversationId, state.conversations, state.filters, currentUserId]);

  const handleConnect = useCallback(() => {
    dispatch({
      type: "SET_CONNECTION",
      payload: { isConnected: true, isConnecting: false, error: null },
    });
  }, []);

  const handleDisconnect = useCallback(() => {
    dispatch({
      type: "SET_CONNECTION",
      payload: { isConnected: false, isConnecting: false, error: null },
    });
  }, []);

  const handleError = useCallback((error: Error) => {
    dispatch({
      type: "SET_CONNECTION",
      payload: { isConnected: false, isConnecting: false, error },
    });
  }, []);

  // Socket hook (específico do chat)
  useChatSocket({
    enabled: true,
    onMessageCreated: handleMessageCreated,
    onMessageUpdated: handleMessageUpdated,
    onConversationCreated: handleConversationCreated,
    onConversationUpdated: handleConversationUpdated,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AÇÕES
  // ─────────────────────────────────────────────────────────────────────────

  const loadConversations = useCallback(
    async (params?: ListConversationsParams) => {
      // IMPORTANTE: Não carrega sem inbox selecionada (evita misturar conversas)
      if (!state.filters.inboxId) {
        console.log("[Chat] Skipping loadConversations - no inbox selected");
        return;
      }

      const filtersSnapshot = { ...state.filters };
      const requestKey = `${filtersSnapshot.inboxId ?? ""}|${filtersSnapshot.status}|${filtersSnapshot.assignee}|${filtersSnapshot.assigneeId ?? ""}`;
      if (
        loadingRef.current.conversations &&
        conversationsInFlightKeyRef.current === requestKey
      ) {
        return;
      }
      loadingRef.current.conversations = true;
      conversationsInFlightKeyRef.current = requestKey;
      lastConversationsRequestTypeRef.current = "list";
      const requestId = ++conversationsRequestRef.current;

      dispatch({ type: "SET_LOADING_CONVERSATIONS", payload: true });

      try {
        const { filters } = state;

        // Traduz os filtros do UI para os parâmetros da API
        // status "waiting" = open + waiting:true
        const isWaiting = filters.status === "waiting";
        const apiStatus: "open" | "resolved" = isWaiting ? "open" : (filters.status === "resolved" ? "resolved" : "open");

        const response = await chatAPI.listConversations({
          assignee: filters.assignee,
          status: apiStatus,
          inboxId: filters.inboxId,
          assigneeId: filters.assignee === "all" ? filters.assigneeId || undefined : undefined,
          waiting: isWaiting ? true : undefined,
          page: 1,
          limit: 25,
          ...params,
        });

        // Ignora resposta se filtros mudaram enquanto carregava
        const latest = filtersRef.current;
        if (
          requestId !== conversationsRequestRef.current ||
          filtersSnapshot.inboxId !== latest.inboxId ||
          filtersSnapshot.status !== latest.status ||
          filtersSnapshot.assignee !== latest.assignee ||
          filtersSnapshot.assigneeId !== latest.assigneeId
        ) {
          return;
        }

        dispatch({
          type: "SET_CONVERSATIONS",
          payload: {
            conversations: response.conversations,
            meta: {
              ...response.pagination,
              hasMore: response.pagination.page < response.pagination.totalPages,
            },
          },
        });
        dispatch({ type: "SET_LAST_SYNC", payload: Date.now() });
      } catch (error) {
        console.error("[Chat] Failed to load conversations:", error);
      } finally {
        if (
          lastConversationsRequestTypeRef.current === "list" &&
          requestId === conversationsRequestRef.current
        ) {
          loadingRef.current.conversations = false;
          conversationsInFlightKeyRef.current = null;
          dispatch({ type: "SET_LOADING_CONVERSATIONS", payload: false });
        }
      }
    },
    [state.filters]
  );

  const loadMoreConversations = useCallback(async () => {
    // IMPORTANTE: Não carrega sem inbox selecionada
    if (!state.filters.inboxId) return;
    if (loadingRef.current.conversations) return;
    if (!state.conversationsMeta.hasMore) return;

    loadingRef.current.conversations = true;
    dispatch({ type: "SET_LOADING_CONVERSATIONS", payload: true });
    lastConversationsRequestTypeRef.current = "more";
    const requestId = ++loadMoreRequestRef.current;
    const filtersSnapshot = { ...state.filters };

    try {
      const { filters, conversationsMeta } = state;

      // Traduz os filtros do UI para os parâmetros da API
      const isWaiting = filters.status === "waiting";
      const apiStatus: "open" | "resolved" = isWaiting ? "open" : (filters.status === "resolved" ? "resolved" : "open");

      const response = await chatAPI.listConversations({
        assignee: filters.assignee,
        status: apiStatus,
        inboxId: filters.inboxId,
        assigneeId: filters.assignee === "all" ? filters.assigneeId || undefined : undefined,
        waiting: isWaiting ? true : undefined,
        page: conversationsMeta.page + 1,
        limit: 25,
      });

      const latest = filtersRef.current;
      if (
        requestId !== loadMoreRequestRef.current ||
        filtersSnapshot.inboxId !== latest.inboxId ||
        filtersSnapshot.status !== latest.status ||
        filtersSnapshot.assignee !== latest.assignee ||
        filtersSnapshot.assigneeId !== latest.assigneeId
      ) {
        return;
      }

      dispatch({
        type: "APPEND_CONVERSATIONS",
        payload: {
          conversations: response.conversations,
          meta: {
            ...response.pagination,
            hasMore: response.pagination.page < response.pagination.totalPages,
          },
        },
      });
    } catch (error) {
      console.error("[Chat] Failed to load more conversations:", error);
    } finally {
      if (
        lastConversationsRequestTypeRef.current === "more" &&
        requestId === loadMoreRequestRef.current
      ) {
        loadingRef.current.conversations = false;
        dispatch({ type: "SET_LOADING_CONVERSATIONS", payload: false });
      }
    }
  }, [state.filters, state.conversationsMeta]);

  const selectConversation = useCallback(
    async (id: string | null) => {
      const isSameConversation = id === state.activeConversationId;
      activeConversationIdRef.current = id;
      dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: id });
      dispatch({ type: "SET_REPLY_TO_MESSAGE", payload: null });
      if (!isSameConversation) {
        activeConversationDetailsRef.current = null;
        dispatch({ type: "SET_ACTIVE_CONVERSATION_DETAILS", payload: null });
      }

      if (id) {
        // Marcar como visto no backend (evitar duplicar chamadas em sequência)
        const lastSeenAt = lastSeenUpdatedRef.current[id] ?? 0;
        const now = Date.now();
        if (now - lastSeenAt > 10_000) {
          lastSeenUpdatedRef.current[id] = now;
          chatAPI.updateLastSeen(id).catch(console.error);
        }

        // Zerar unreadCount localmente (igual ao Chatwoot)
        dispatch({
          type: "UPDATE_CONVERSATION",
          payload: { id, unreadCount: 0 },
        });

        const hasMessages = Boolean(state.messages[id]);
        const hasMeta = Boolean(state.messagesMeta[id]);

        // Carregar mensagens se não tiver ou se não tiver meta (histórico incompleto)
        if (!hasMessages || !hasMeta) {
          dispatch({ type: "SET_LOADING_MESSAGES", payload: true });
          try {
            const response = await chatAPI.listMessages(id, { limit: 50 });
            dispatch({
              type: "SET_MESSAGES",
              payload: {
                conversationId: id,
                messages: response.data, // API já retorna em ordem cronológica (antigas primeiro)
                meta: response.meta,
              },
            });
          } catch (error) {
            console.error("[Chat] Failed to load messages:", error);
            dispatch({ type: "SET_LOADING_MESSAGES", payload: false });
          }
        }
      }
    },
    [state.messages, state.messagesMeta, state.activeConversationId]
  );

  const openConversationById = useCallback(
    async (id: string) => {
      if (openConversationInFlightRef.current.has(id)) return;
      openConversationInFlightRef.current.add(id);
      const existing = conversationsRef.current.find((c) => c.id === id);
      await selectConversation(id);

      if (!existing) {
        try {
          const conversation = await chatAPI.getConversation(id);
          // Não adiciona na lista (respeita filtro atual)
          dispatch({ type: "SET_ACTIVE_CONVERSATION_DETAILS", payload: conversation });
        } catch (error) {
          console.error("[Chat] Failed to fetch conversation:", error);
        } finally {
          openConversationInFlightRef.current.delete(id);
        }
      } else {
        openConversationInFlightRef.current.delete(id);
      }
    },
    [selectConversation]
  );

  const loadMessages = useCallback(async (conversationId: string) => {
    if (loadingRef.current.messages.has(conversationId)) return;
    loadingRef.current.messages.add(conversationId);

    dispatch({ type: "SET_LOADING_MESSAGES", payload: true });

    try {
      const response = await chatAPI.listMessages(conversationId, { limit: 50 });
      dispatch({
        type: "SET_MESSAGES",
        payload: {
          conversationId,
          messages: response.data, // API já retorna em ordem cronológica (antigas primeiro)
          meta: response.meta,
        },
      });
    } catch (error) {
      console.error("[Chat] Failed to load messages:", error);
      dispatch({ type: "SET_LOADING_MESSAGES", payload: false });
    } finally {
      loadingRef.current.messages.delete(conversationId);
    }
  }, []);

  const clearConversationMessages = useCallback(async (conversationId: string) => {
    try {
      await chatAPI.clearConversationMessages(conversationId);
      // Limpa as mensagens no estado local
      dispatch({
        type: "SET_MESSAGES",
        payload: {
          conversationId,
          messages: [],
          meta: { hasMore: false },
        },
      });
      // Também limpa lastMessage no estado da conversa
      dispatch({
        type: "UPDATE_CONVERSATION",
        payload: { id: conversationId, lastMessage: null },
      });
    } catch (error) {
      console.error("[Chat] Failed to clear messages:", error);
      throw error;
    }
  }, []);

  const loadMoreMessages = useCallback(
    async (conversationId: string) => {
      if (loadingRef.current.messages.has(conversationId)) return;

      const meta = state.messagesMeta[conversationId];
      if (!meta?.hasMore || !meta?.oldestId) return;

      loadingRef.current.messages.add(conversationId);
      dispatch({ type: "SET_LOADING_MESSAGES", payload: true });

      try {
        const response = await chatAPI.listMessages(conversationId, {
          before: meta.oldestId,
          limit: 50,
        });

        dispatch({
          type: "PREPEND_MESSAGES",
          payload: {
            conversationId,
            messages: response.data, // API já retorna em ordem cronológica (antigas primeiro)
            meta: response.meta,
          },
        });
      } catch (error) {
        console.error("[Chat] Failed to load more messages:", error);
        dispatch({ type: "SET_LOADING_MESSAGES", payload: false });
      } finally {
        loadingRef.current.messages.delete(conversationId);
      }
    },
    [state.messagesMeta]
  );

  /**
   * Envia uma mensagem de texto para a conversa
   * @throws {OutOfWindowError} Se fora da janela de 24h
   * @throws {ChatError} Para outros erros
   */
  const sendMessage = useCallback(
    async (conversationId: string, content: string, options?: { inReplyTo?: string }) => {
      if (!content.trim()) return;

      dispatch({ type: "SET_SENDING_MESSAGE", payload: true });

      try {
        const params: SendTextParams = {
          conversationId,
          content: content.trim(),
          contentType: "text",
          inReplyTo: options?.inReplyTo,
        };

        const response = await chatAPI.sendMessage(params);

        // Adiciona localmente (WebSocket também vai enviar, mas ADD_MESSAGE é idempotente)
        // Usa createdAt da mensagem como lastActivityAt (será sobrescrito pelo WebSocket com valor do servidor)
        dispatch({
          type: "ADD_MESSAGE",
          payload: {
            message: response.message,
            conversationUpdate: {
              lastActivityAt: response.message.createdAt
            }
          }
        });
        dispatch({ type: "SET_REPLY_TO_MESSAGE", payload: null });

        return response.message;
      } catch (error: unknown) {
        console.error("[Chat] Failed to send message:", error);

        // Tratar erros específicos
        if (error instanceof Error) {
          const errorMessage = error.message || "";

          // Erro de janela de 24h
          if (errorMessage.includes("OUT_OF_24H_WINDOW") || errorMessage.includes("24")) {
            throw new OutOfWindowError();
          }

          throw new ChatError(errorMessage, "SEND_FAILED");
        }

        throw new ChatError("Falha ao enviar mensagem", "UNKNOWN");
      } finally {
        dispatch({ type: "SET_SENDING_MESSAGE", payload: false });
      }
    },
    []
  );

  /**
   * Envia uma mensagem com anexo (imagem, vídeo, áudio, documento)
   * Igual ao Chatwoot: uma mensagem por anexo
   * @throws {OutOfWindowError} Se fora da janela de 24h
   * @throws {ChatError} Para outros erros
   */
  const sendMessageWithAttachment = useCallback(
    async (
      conversationId: string,
      options: {
        content?: string;
        inReplyTo?: string;
        attachment: {
          fileType: string;
          fileUrl: string;
          fileName?: string;
          fileSize?: number;
          mimeType?: string;
        };
      }
    ) => {
      dispatch({ type: "SET_SENDING_MESSAGE", payload: true });

      try {
        const response = await chatAPI.sendMessage({
          conversationId,
          content: options.content || "",
          contentType: options.attachment.fileType as "image" | "video" | "audio" | "document",
          inReplyTo: options.inReplyTo,
          attachment: {
            fileUrl: options.attachment.fileUrl,
            fileName: options.attachment.fileName,
            fileSize: options.attachment.fileSize,
            mimeType: options.attachment.mimeType,
          },
        });

        dispatch({
          type: "ADD_MESSAGE",
          payload: {
            message: response.message,
            conversationUpdate: {
              lastActivityAt: response.message.createdAt,
            },
          },
        });
        dispatch({ type: "SET_REPLY_TO_MESSAGE", payload: null });

        return response.message;
      } catch (error: unknown) {
        console.error("[Chat] Failed to send message with attachment:", error);

        if (error instanceof Error) {
          const errorMessage = error.message || "";

          if (errorMessage.includes("OUT_OF_24H_WINDOW") || errorMessage.includes("24")) {
            throw new OutOfWindowError();
          }

          throw new ChatError(errorMessage, "SEND_FAILED");
        }

        throw new ChatError("Falha ao enviar mensagem", "UNKNOWN");
      } finally {
        dispatch({ type: "SET_SENDING_MESSAGE", payload: false });
      }
    },
    []
  );

  /**
   * Envia um template para a conversa
   * @throws {ChatError} Para erros
   */
  const sendTemplate = useCallback(
    async (
      conversationId: string,
      template: {
        name: string;
        languageCode: string;
        components: TemplateComponent[];
      }
    ) => {
      dispatch({ type: "SET_SENDING_MESSAGE", payload: true });

      try {
        const response = await chatAPI.sendMessage({
          conversationId,
          contentType: "template",
          template,
        });

        // Adiciona localmente (WebSocket também vai enviar, mas ADD_MESSAGE é idempotente)
        dispatch({
          type: "ADD_MESSAGE",
          payload: {
            message: response.message,
            conversationUpdate: {
              lastActivityAt: response.message.createdAt,
            }
          }
        });

        return response.message;
      } catch (error: unknown) {
        console.error("[Chat] Failed to send template:", error);

        if (error instanceof Error) {
          throw new ChatError(error.message, "TEMPLATE_SEND_FAILED");
        }

        throw new ChatError("Falha ao enviar template", "UNKNOWN");
      } finally {
        dispatch({ type: "SET_SENDING_MESSAGE", payload: false });
      }
    },
    []
  );

  const resolveConversation = useCallback(async (id: string) => {
    try {
      const updated = await chatAPI.resolveConversation(id);

      // Se o filtro atual não é "resolved", a conversa deve sair da lista
      if (state.filters.status !== "resolved") {
        if (state.activeConversationId === id) {
          dispatch({
            type: "UPDATE_CONVERSATION",
            payload: { id, status: updated.status },
          });
        } else {
          dispatch({ type: "REMOVE_CONVERSATION", payload: id });
        }
      } else {
        dispatch({
          type: "UPDATE_CONVERSATION",
          payload: { id, status: updated.status },
        });
      }

      // Recarregar contagens (conversa mudou de status)
      reloadCountsRef.current();
    } catch (error) {
      console.error("[Chat] Failed to resolve conversation:", error);
      throw error;
    }
  }, [state.filters.status]);

  const assignConversation = useCallback(
    async (id: string, assigneeId: string | null) => {
      try {
        const updated = await chatAPI.assignConversation(id, assigneeId)

        // Atualiza a lista imediatamente (mesmo que o backend retorne só parte dos dados)
        dispatch({
          type: "UPDATE_CONVERSATION",
          payload: {
            id,
            assigneeId: updated.assigneeId,
            ...(updated.assignee !== undefined && { assignee: updated.assignee }),
          },
        })

        // Buscar detalhes completos para refletir nome/email do assignee na UI
        const full = await chatAPI.getConversation(id).catch(() => null)
        if (full) {
          dispatch({ type: "UPDATE_CONVERSATION", payload: full })
          if (state.activeConversationId === id) {
            dispatch({ type: "SET_ACTIVE_CONVERSATION_DETAILS", payload: full })
          }
        }
      } catch (error) {
        console.error("[Chat] Failed to assign conversation:", error);
        throw error;
      }
    },
    [state.activeConversationId]
  );

  const associateClientToConversation = useCallback(
    async (conversationId: string, params: { cnpj?: string; clientId?: number }) => {
      try {
        const updated = await chatAPI.associateClientToConversation(conversationId, params);
        const exists = state.conversations.some((c) => c.id === updated.id);
        if (exists) {
          dispatch({
            type: "UPDATE_CONVERSATION",
            payload: updated,
          });
        } else {
          dispatch({ type: "ADD_CONVERSATION", payload: updated });
        }

        if (state.activeConversationId === conversationId) {
          dispatch({ type: "SET_ACTIVE_CONVERSATION_DETAILS", payload: updated });
        }

        return updated;
      } catch (error) {
        console.error("[Chat] Failed to associate client:", error);
        throw error;
      }
    },
    [state.conversations]
  );

  const unassociateClientFromConversation = useCallback(
    async (conversationId: string, clientId: number) => {
      const applyLocalRemove = (conv: Conversation): Conversation => {
        const contact = conv.contact
        if (!contact) return conv
        const clients = contact.clients ?? []
        const nextClients = clients.filter((c) => c.id !== clientId)
        if (nextClients.length === clients.length) return conv
        return {
          ...conv,
          contact: {
            ...contact,
            clients: nextClients,
          },
        }
      }

      const current = state.conversations.find((c) => c.id === conversationId) ?? null
      if (current) {
        dispatch({ type: "UPDATE_CONVERSATION", payload: applyLocalRemove(current) })
      }

      if (state.activeConversationId === conversationId && state.activeConversationDetails) {
        dispatch({
          type: "SET_ACTIVE_CONVERSATION_DETAILS",
          payload: applyLocalRemove(state.activeConversationDetails),
        })
      }

      try {
        await chatAPI.unassociateClientFromConversation(conversationId, clientId)
      } catch (error) {
        console.error("[Chat] Failed to unassociate client:", error)
        const full = await chatAPI.getConversation(conversationId).catch(() => null)
        if (full) {
          dispatch({ type: "UPDATE_CONVERSATION", payload: full })
          if (state.activeConversationId === conversationId) {
            dispatch({ type: "SET_ACTIVE_CONVERSATION_DETAILS", payload: full })
          }
        }
        throw error
      }
    },
    [state.conversations, state.activeConversationId, state.activeConversationDetails]
  )

  const setFilters = useCallback((filters: Partial<ChatFilters>) => {
    dispatch({ type: "SET_FILTERS", payload: filters });
  }, []);

  const setReplyToMessageId = useCallback((id: string | null) => {
    dispatch({ type: "SET_REPLY_TO_MESSAGE", payload: id });
  }, []);

  const clearReplyToMessage = useCallback(() => {
    dispatch({ type: "SET_REPLY_TO_MESSAGE", payload: null });
  }, []);

  const loadInboxes = useCallback(async () => {
    if (inboxesLoadedRef.current) return;
    inboxesLoadedRef.current = true;
    try {
      const inboxes = await chatAPI.listInboxes();
      dispatch({ type: "SET_INBOXES", payload: inboxes });
    } catch (error) {
      inboxesLoadedRef.current = false;
      console.error("[Chat] Failed to load inboxes:", error);
    }
  }, []);

  // Mantém o ref de filtros atualizado (evita race entre abas)
  useEffect(() => {
    filtersRef.current = state.filters;
  }, [state.filters]);

  // Carrega contagens por status para a inbox selecionada
  const loadStatusCounts = useCallback(async () => {
    const { inboxId, assignee, assigneeId } = state.filters;
    if (!inboxId) {
      console.log("[Chat] Skipping loadStatusCounts - no inbox selected");
      return;
    }

    const filtersSnapshot = { ...state.filters };
    const requestKey = `${filtersSnapshot.inboxId ?? ""}|${filtersSnapshot.assignee}|${filtersSnapshot.assigneeId ?? ""}`;
    if (state.isLoadingCounts && countsInFlightKeyRef.current === requestKey) {
      return;
    }
    countsInFlightKeyRef.current = requestKey;
    dispatch({ type: "SET_LOADING_COUNTS", payload: true });
    const requestId = ++countsRequestRef.current;

    try {
      const counts = await chatAPI.getStatusCounts(
        inboxId,
        assignee,
        assignee === "all" ? assigneeId || undefined : undefined
      );
      // Ignora resposta se filtros mudaram enquanto carregava
      const latest = filtersRef.current;
      if (
        requestId !== countsRequestRef.current ||
        filtersSnapshot.inboxId !== latest.inboxId ||
        filtersSnapshot.assignee !== latest.assignee ||
        filtersSnapshot.assigneeId !== latest.assigneeId
      ) {
        return;
      }
      dispatch({ type: "SET_STATUS_COUNTS", payload: counts });
    } catch (error) {
      console.error("[Chat] Failed to load status counts:", error);
    } finally {
      if (requestId === countsRequestRef.current) {
        countsInFlightKeyRef.current = null;
        dispatch({ type: "SET_LOADING_COUNTS", payload: false });
      }
    }
  }, [state.filters.inboxId, state.filters.assignee, state.filters.assigneeId]);

  // Atualiza ref com a função atual (para uso nos handlers de WebSocket)
  useEffect(() => {
    reloadCountsRef.current = loadStatusCounts;
  }, [loadStatusCounts]);

  // Mantém referência estável das conversas
  useEffect(() => {
    conversationsRef.current = state.conversations;
  }, [state.conversations]);

  useEffect(() => {
    activeConversationIdRef.current = state.activeConversationId;
    activeConversationDetailsRef.current = state.activeConversationDetails;
  }, [state.activeConversationId, state.activeConversationDetails]);

  const fetchConversationDetails = useCallback(async (id: string): Promise<Conversation | null> => {
    if (conversationFetchInFlightRef.current.has(id)) return null;
    conversationFetchInFlightRef.current.add(id);
    try {
      return await chatAPI.getConversation(id);
    } catch (error) {
      console.error("[Chat] Failed to fetch conversation:", error);
      return null;
    } finally {
      conversationFetchInFlightRef.current.delete(id);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // EFEITOS
  // ─────────────────────────────────────────────────────────────────────────

  // Carrega inboxes na inicialização
  useEffect(() => {
    loadInboxes();
  }, [loadInboxes]);

  // Recarrega conversas quando filtros mudam
  // IMPORTANTE: Só carrega se tiver uma inbox selecionada
  useEffect(() => {
    if (state.filters.inboxId) {
      loadConversations();
    }
  }, [state.filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recarrega contagens quando inbox ou assignee mudam
  useEffect(() => {
    if (state.filters.inboxId) {
      loadStatusCounts();
    }
  }, [state.filters.inboxId, state.filters.assignee, state.filters.assigneeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────────────────────────────

  const activeConversation = useMemo(() => {
    if (!state.activeConversationId) return null;
    return (
      state.conversations.find((c) => c.id === state.activeConversationId) ||
      state.activeConversationDetails ||
      null
    );
  }, [state.activeConversationId, state.conversations, state.activeConversationDetails]);

  const activeMessages = useMemo(() => {
    if (!state.activeConversationId) return [];
    return state.messages[state.activeConversationId] || [];
  }, [state.activeConversationId, state.messages]);

  // ─────────────────────────────────────────────────────────────────────────
  // VALOR DO CONTEXTO
  // ─────────────────────────────────────────────────────────────────────────

  const value: ChatContextValue = useMemo(
    () => ({
      state,
      loadConversations,
      loadMoreConversations,
      selectConversation,
      openConversationById,
      resolveConversation,
      assignConversation,
      associateClientToConversation,
      unassociateClientFromConversation,
      clearConversationMessages,
      loadMessages,
      loadMoreMessages,
      sendMessage,
      sendMessageWithAttachment,
      sendTemplate,
      setFilters,
      setReplyToMessageId,
      clearReplyToMessage,
      loadInboxes,
      loadStatusCounts,
      activeConversation,
      activeMessages,
      replyToMessageId: state.replyToMessageId,
      statusCounts: state.statusCounts,
    }),
    [
      state,
      loadConversations,
      loadMoreConversations,
      selectConversation,
      openConversationById,
      resolveConversation,
      assignConversation,
      associateClientToConversation,
      unassociateClientFromConversation,
      clearConversationMessages,
      loadMessages,
      loadMoreMessages,
      sendMessage,
      sendMessageWithAttachment,
      sendTemplate,
      setFilters,
      setReplyToMessageId,
      clearReplyToMessage,
      loadInboxes,
      loadStatusCounts,
      activeConversation,
      activeMessages,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// ════════════════════════════════════════════════════════════════════════════
// HOOK
// ════════════════════════════════════════════════════════════════════════════

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}

export function useChatOptional() {
  return useContext(ChatContext);
}

export function ChatProviderAuto({ children }: { children: React.ReactNode }) {
  const existing = useChatOptional();
  if (existing) {
    return <>{children}</>;
  }
  return <ChatProvider>{children}</ChatProvider>;
}
