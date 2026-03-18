"use client";

import { useSocket } from "@/lib/socket";

export type ChatbotSessionEvent = {
  conversationId: string;
  inboxId?: string;
  sessionId?: string;
  flowId?: string;
  active: boolean;
  reason?: string;
};

export interface ChatbotSocketEvents {
  "chatbot.session.active": ChatbotSessionEvent;
  "chatbot.session.inactive": ChatbotSessionEvent;
}

export interface UseChatbotSocketOptions {
  enabled?: boolean;
  onActive?: (event: ChatbotSessionEvent) => void;
  onInactive?: (event: ChatbotSessionEvent) => void;
}

async function getChatSocketToken(): Promise<string> {
  const response = await fetch("/api/chat/realtime/token");
  if (!response.ok) {
    throw new Error("Failed to get chat socket token");
  }
  const data = await response.json();
  return data.token;
}

export function useChatbotSocket(options: UseChatbotSocketOptions = {}) {
  const { enabled = true, onActive, onInactive } = options;
  return useSocket<ChatbotSocketEvents>({
    enabled,
    getToken: getChatSocketToken,
    events: {
      "chatbot.session.active": onActive,
      "chatbot.session.inactive": onInactive,
    },
  });
}
