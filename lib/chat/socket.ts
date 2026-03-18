"use client";

import { useSocket } from "@/lib/socket";
import type { Message } from "./api";

// ════════════════════════════════════════════════════════════════════════════
// TIPOS DE EVENTOS DO CHAT
// ════════════════════════════════════════════════════════════════════════════

export interface ChatSocketAttachment {
  id: string;
  fileType: string;
  downloadStatus?: "pending" | "downloading" | "completed" | "failed";
  fileName?: string;
  mimeType?: string;
}

export interface ChatSocketMessage {
  id: string;
  conversationId: string;
  content?: string;
  contentType: string;
  messageType: "incoming" | "outgoing" | "template";
  status: string;
  externalError?: string | null;  // Erro retornado pelo provedor
  createdAt: string;
  timestamp?: string;  // Legacy - usar createdAt
  inboxId?: string;
  // Attachments da mensagem (enviados no message.created)
  attachments?: ChatSocketAttachment[];
  // ContentAttributes (inclui inReplyTo para replies)
  contentAttributes?: {
    inReplyTo?: string;  // ID da mensagem respondida
    [key: string]: unknown;
  };
  // Dados da conversa (igual ao Chatwoot) para atualizar lastActivityAt, unreadCount e reordenar
  conversation?: {
    id: string;
    lastActivityAt?: string;
    status?: string;
    waitingSince?: string | null;
    assigneeId?: string | null;
    agentLastSeenAt?: string | null;
    unreadCount?: number;  // ← Enviado pelo backend
    canReply?: boolean;    // ← Enviado pelo backend (janela de 24h)
  };
  // Atualização de attachment (enviado no message.updated quando download completa/falha)
  attachment?: {
    id: string;
    downloadStatus: "pending" | "downloading" | "completed" | "failed";
  };
}

export interface ChatSocketConversation {
  id: string;
  conversationId?: string;
  status: string;
  waitingSince?: string | null;
  lastActivityAt?: string;
  assigneeId?: string | null;
  inboxId?: string;
  agentLastSeenAt?: string | null;
  unreadCount?: number;  // ← Enviado pelo backend
  canReply?: boolean;    // ← Enviado pelo backend (janela de 24h)
}

export interface ChatSocketEvents {
  "message.created": ChatSocketMessage;
  "message.updated": ChatSocketMessage;
  "conversation.created": ChatSocketConversation;
  "conversation.updated": ChatSocketConversation;
  "presence.update": { status: string; userId: string };
}

// ════════════════════════════════════════════════════════════════════════════
// OPÇÕES DO HOOK DE CHAT
// ════════════════════════════════════════════════════════════════════════════

export interface UseChatSocketOptions {
  enabled?: boolean;
  onMessageCreated?: (message: ChatSocketMessage) => void;
  onMessageUpdated?: (message: ChatSocketMessage) => void;
  onConversationCreated?: (conversation: ChatSocketConversation) => void;
  onConversationUpdated?: (conversation: ChatSocketConversation) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
}

export interface UseChatSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  reconnect: () => void;
}

// ════════════════════════════════════════════════════════════════════════════
// FUNÇÃO PARA OBTER TOKEN
// ════════════════════════════════════════════════════════════════════════════

async function getChatSocketToken(): Promise<string> {
  const response = await fetch("/api/chat/realtime/token");
  if (!response.ok) {
    throw new Error("Failed to get chat socket token");
  }
  const data = await response.json();
  return data.token;
}

// ════════════════════════════════════════════════════════════════════════════
// HOOK DO CHAT
// ════════════════════════════════════════════════════════════════════════════

export function useChatSocket(options: UseChatSocketOptions = {}): UseChatSocketReturn {
  const {
    enabled = true,
    onMessageCreated,
    onMessageUpdated,
    onConversationCreated,
    onConversationUpdated,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const { isConnected, isConnecting, error, reconnect } = useSocket<ChatSocketEvents>({
    enabled,
    getToken: getChatSocketToken,
    events: {
      "message.created": onMessageCreated,
      "message.updated": onMessageUpdated,
      "conversation.created": onConversationCreated,
      "conversation.updated": onConversationUpdated,
    },
    onConnect,
    onDisconnect,
    onError,
  });

  return {
    isConnected,
    isConnecting,
    error,
    reconnect,
  };
}
