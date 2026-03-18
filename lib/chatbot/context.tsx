"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { getActiveChatbotSession } from "./api";
import { useChatbotSocket, ChatbotSessionEvent } from "./socket";

type ChatbotStatus = "active" | "inactive" | "none";

type ChatbotStatusContextValue = {
  getStatus: (conversationId: string) => ChatbotStatus;
  ensureLoaded: (conversationId: string) => Promise<void>;
  updateStatus: (conversationId: string, status: ChatbotStatus) => void;
};

const ChatbotStatusContext = createContext<ChatbotStatusContextValue | null>(null);

export function ChatbotProvider({ children }: { children: React.ReactNode }) {
  const [statusMap, setStatusMap] = useState<Record<string, ChatbotStatus>>({});
  const loadedRef = useRef<Set<string>>(new Set());

  const setStatus = useCallback((conversationId: string, status: ChatbotStatus) => {
    setStatusMap((prev) => {
      if (prev[conversationId] === status) return prev;
      return { ...prev, [conversationId]: status };
    });
  }, []);

  const handleActive = useCallback(
    (event: ChatbotSessionEvent) => {
      if (!event?.conversationId) return;
      setStatus(event.conversationId, "active");
    },
    [setStatus]
  );

  const handleInactive = useCallback(
    (event: ChatbotSessionEvent) => {
      if (!event?.conversationId) return;
      setStatusMap((prev) => {
        const current = prev[event.conversationId];
        if (current !== "active" && current !== "inactive") {
          return prev;
        }
        return { ...prev, [event.conversationId]: "inactive" };
      });
    },
    []
  );

  useChatbotSocket({
    onActive: handleActive,
    onInactive: handleInactive,
  });

  const ensureLoaded = useCallback(async (conversationId: string) => {
    if (!conversationId || loadedRef.current.has(conversationId)) return;
    loadedRef.current.add(conversationId);
    try {
      const session = await getActiveChatbotSession(conversationId);
      if (session?.status === "ACTIVE") {
        setStatus(conversationId, "active");
      } else {
        setStatus(conversationId, "none");
      }
    } catch {
      loadedRef.current.delete(conversationId);
    }
  }, [setStatus]);

  const value = useMemo<ChatbotStatusContextValue>(
    () => ({
      getStatus: (conversationId: string) => statusMap[conversationId] ?? "none",
      ensureLoaded,
      updateStatus: setStatus,
    }),
    [statusMap, ensureLoaded, setStatus]
  );

  return <ChatbotStatusContext.Provider value={value}>{children}</ChatbotStatusContext.Provider>;
}

export function useChatbotStatus(conversationId: string | null | undefined, initialStatus?: ChatbotStatus) {
  const context = useContext(ChatbotStatusContext);
  if (!context) {
    throw new Error("useChatbotStatus must be used within ChatbotProvider");
  }

  // Se temos um status inicial e ainda não está no mapa, injeta ele (silent)
  if (conversationId && initialStatus && initialStatus !== "none" && context.getStatus(conversationId) === "none") {
    context.updateStatus(conversationId, initialStatus);
  }

  const status = conversationId ? context.getStatus(conversationId) : "none";
  const ensureLoaded = useCallback(() => {
    if (conversationId) {
      return context.ensureLoaded(conversationId);
    }
    return Promise.resolve();
  }, [conversationId, context]);

  return { status, ensureLoaded };
}
