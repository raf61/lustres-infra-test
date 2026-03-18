"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChatSocket, ChatSocketMessage, ChatSocketConversation } from "./socket";
import { chatAPI } from "./api";
import { useChatbotSocket, type ChatbotSessionEvent } from "@/lib/chatbot/socket";

export type VendorChatSummary = {
  clientId: number;
  conversationId: string;
  lastMessage: string | null;
  lastMessageType: "incoming" | "outgoing" | "template" | null;
  lastActivityAt: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  waitingSince: string | null;
  agentLastSeenAt: string | null;
  status: string;
  chatbotActive: boolean;
  lastMessageStatus?: string | null;
  contentAttributes?: any;
};

type ConversationClientMap = Record<string, number[]>;
type ClientSummaryMap = Record<number, VendorChatSummary>;

function parseMessageType(input: unknown): VendorChatSummary["lastMessageType"] {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "incoming" || raw === "outgoing" || raw === "template") return raw;
  return null;
}

function interpolateTemplate(content: string, contentAttributes: any): string {
  if (!content || !contentAttributes?.template?.components) return content;

  let interpolated = content;
  const bodyParams = contentAttributes.template.components.find(
    (c: any) => c.type?.toLowerCase() === 'body'
  )?.parameters;

  if (Array.isArray(bodyParams)) {
    bodyParams.forEach((param: any, index: number) => {
      let value = '';
      if (param.type === 'text') value = param.text;
      else if (param.type === 'currency') value = String(param.currency?.fallback_value || '');
      else if (param.type === 'date_time') value = String(param.date_time?.fallback_value || '');

      const valStr = String(value ?? '');

      // Try named placeholder first (e.g. {{nome_pessoa}})
      if (param.parameter_name) {
        const namedPlaceholder = `{{${param.parameter_name}}}`;
        interpolated = interpolated.split(namedPlaceholder).join(valStr);
      }

      // Also try positional placeholder (e.g. {{1}})
      const positionalPlaceholder = `{{${index + 1}}}`;
      interpolated = interpolated.split(positionalPlaceholder).join(valStr);
    });
  }

  return interpolated;
}

export function useVendorChatRealtime(clientIds: number[]) {
  const [summaryMap, setSummaryMap] = useState<ClientSummaryMap>({});
  const [conversationToClients, setConversationToClients] = useState<ConversationClientMap>({});
  const mappingFetchInFlight = useRef<Set<string>>(new Set());

  // Refs para ter sempre o valor mais atual nos callbacks do socket
  const summaryMapRef = useRef<ClientSummaryMap>({});
  const conversationToClientsRef = useRef<ConversationClientMap>({});
  const normalizedClientIdsRef = useRef<number[]>([]);

  // Manter refs sincronizadas
  useEffect(() => {
    summaryMapRef.current = summaryMap;
  }, [summaryMap]);

  useEffect(() => {
    conversationToClientsRef.current = conversationToClients;
  }, [conversationToClients]);

  // Log inicial
  useEffect(() => {
    console.log("[VendorRealtime] hook mounted with clientIds:", clientIds);
  }, [clientIds]);

  const normalizedClientIds = useMemo(
    () => Array.from(new Set(clientIds.filter((id) => Number.isFinite(id)))),
    [clientIds]
  );

  // Manter ref de clientIds sincronizada
  useEffect(() => {
    normalizedClientIdsRef.current = normalizedClientIds;
  }, [normalizedClientIds]);

  const preloadSummaries = useCallback(async () => {
    const currentClientIds = normalizedClientIdsRef.current;
    console.log("[VendorRealtime] preloadSummaries called with", currentClientIds.length, "clients");
    if (currentClientIds.length === 0) {
      setSummaryMap({});
      setConversationToClients({});
      return;
    }

    const response = await chatAPI.listClientConversationSummaries(currentClientIds);
    const summaries = Array.isArray(response?.summaries) ? response.summaries : [];
    console.log("[VendorRealtime] preloadSummaries: received", summaries.length, "summaries");
    const nextSummaryMap: ClientSummaryMap = {};
    const nextConversationMap: ConversationClientMap = {};
    console.log("[VendorRealtime] preloadSummaries: summaries", summaries);
    summaries.forEach((summary: any) => {
      const clientId = Number(summary.clientId);
      if (!Number.isFinite(clientId)) return;

      // Regra: só mostra se está "esperando" (status=open + waitingSince != null)
      const isWaiting = summary.status === "open" && !!summary.waitingSince;
      let lastMessage = summary.lastMessage?.content ?? null;
      const lastMessageType = parseMessageType(summary.lastMessage?.messageType);

      if (lastMessageType === "template" && lastMessage && summary.lastMessage?.contentAttributes) {
        lastMessage = interpolateTemplate(lastMessage, summary.lastMessage.contentAttributes);
      }

      nextSummaryMap[clientId] = {
        clientId,
        conversationId: summary.conversationId,
        lastMessage,
        lastMessageType,
        lastActivityAt: summary.lastActivityAt ?? null,
        lastMessageAt: summary.lastMessage?.createdAt ?? null,
        unreadCount: isWaiting ? (summary.unreadCount ?? 0) : 0,
        waitingSince: summary.waitingSince ?? null,
        agentLastSeenAt: summary.agentLastSeenAt ?? null,
        status: summary.status,
        chatbotActive: false,
        lastMessageStatus: summary.lastMessage?.status ?? null,
        contentAttributes: summary.lastMessage?.contentAttributes ?? null,
      };

      if (!nextConversationMap[summary.conversationId]) {
        nextConversationMap[summary.conversationId] = [];
      }
      if (!nextConversationMap[summary.conversationId].includes(clientId)) {
        nextConversationMap[summary.conversationId].push(clientId);
      }
    });

    setSummaryMap(nextSummaryMap);
    setConversationToClients(nextConversationMap);

    // Preload de status do chatbot por conversa (1 request batch)
    try {
      const conversationIds = Object.values(nextSummaryMap).map((s) => s.conversationId);
      const uniqueConversationIds = Array.from(new Set(conversationIds));
      if (uniqueConversationIds.length > 0) {
        const res = await fetch("/api/chatbot/sessions/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationIds: uniqueConversationIds }),
        });
        if (res.ok) {
          const payload = await res.json().catch(() => ({}));
          const activeIds = new Set<string>(
            Array.isArray(payload?.activeConversationIds) ? payload.activeConversationIds : [],
          );
          setSummaryMap((prev) => {
            const next = { ...prev };
            Object.values(next).forEach((s) => {
              next[s.clientId] = { ...s, chatbotActive: activeIds.has(s.conversationId) };
            });
            return next;
          });
        }
      }
    } catch (err) {
      console.warn("[VendorRealtime] failed to preload chatbot active statuses", err);
    }
  }, []); // deps vazia: lê clientIds via ref, identidade estável e sem loop

  // Dispara preload quando os IDs mudam de verdade (não apenas referência)
  useEffect(() => {
    preloadSummaries().catch(console.error);
  }, [preloadSummaries, normalizedClientIds]); // normalizedClientIds aqui é seguro pq preloadSummaries é estável


  const resolveConversationClients = useCallback(async (conversationId: string): Promise<number[]> => {
    // Primeiro checar o ref mais atual
    const currentMap = conversationToClientsRef.current;
    if (currentMap[conversationId] && currentMap[conversationId].length > 0) {
      console.log("[VendorRealtime] resolveConversationClients: found in cache", {
        conversationId,
        clients: currentMap[conversationId],
      });
      return currentMap[conversationId];
    }

    if (mappingFetchInFlight.current.has(conversationId)) {
      // Esperar um pouco e tentar de novo do ref
      console.log("[VendorRealtime] resolveConversationClients: waiting for in-flight request", conversationId);
      await new Promise((r) => setTimeout(r, 100));
      return conversationToClientsRef.current[conversationId] || [];
    }

    console.log("[VendorRealtime] resolveConversationClients: fetching from API", conversationId);
    mappingFetchInFlight.current.add(conversationId);
    try {
      const response = await chatAPI.getConversationClients(conversationId);
      const resolvedClientIds = Array.isArray(response?.clientIds)
        ? response.clientIds.filter((id: number) => Number.isFinite(id))
        : [];

      console.log("[VendorRealtime] resolveConversationClients: API returned", {
        conversationId,
        clientIds: resolvedClientIds,
      });

      if (resolvedClientIds.length > 0) {
        setConversationToClients((prev) => ({
          ...prev,
          [conversationId]: resolvedClientIds,
        }));
      }
      return resolvedClientIds;
    } finally {
      mappingFetchInFlight.current.delete(conversationId);
    }
  }, []);

  const handleMessageCreated = useCallback(
    async (payload: ChatSocketMessage) => {
      const conversationId = payload.conversationId;
      console.log("[VendorRealtime] message.created received", {
        conversationId,
        content: payload.content,
        messageType: payload.messageType,
        conversation: payload.conversation,
      });

      // Resolver clientes associados a esta conversa
      let clients = await resolveConversationClients(conversationId);

      // Filtrar só os clientes que estão no dashboard (usar ref para ter valor atual)
      const dashboardClientIds = new Set(normalizedClientIdsRef.current);
      clients = clients.filter((id) => dashboardClientIds.has(id));

      if (clients.length === 0) {
        console.log("[VendorRealtime] no matching clients for conversation", conversationId);
        return;
      }

      console.log("[VendorRealtime] clients to update", clients);

      const messageTimestamp = payload.createdAt ?? new Date().toISOString();
      const status = payload.conversation?.status || "open";
      const waitingSince = payload.conversation?.waitingSince ?? null;

      // Regra: só mostra se está "esperando" (status=open + waitingSince != null)
      const isWaiting = status === "open" && !!waitingSince;
      const unreadCount = isWaiting ? (payload.conversation?.unreadCount ?? 1) : 0;
      let lastMessageContent = payload.content ?? null;
      const lastMessageType = parseMessageType(payload.messageType);

      if (lastMessageType === "template" && lastMessageContent && payload.contentAttributes) {
        lastMessageContent = interpolateTemplate(lastMessageContent, payload.contentAttributes);
      }

      console.log("[VendorRealtime] computed values", {
        status,
        waitingSince,
        isWaiting,
        unreadCount,
        lastMessageContent,
      });

      // Usar lastActivityAt da conversa (mais preciso) ou createdAt da mensagem
      const activityTimestamp = payload.conversation?.lastActivityAt ?? messageTimestamp;

      console.log("[VendorRealtime] calling setSummaryMap with clients:", clients);
      setSummaryMap((prev) => {
        console.log("[VendorRealtime] inside setSummaryMap, prev keys:", Object.keys(prev));
        const next = { ...prev };
        clients.forEach((clientId) => {
          const existing = prev[clientId];

          // Para message.created: sempre atualiza se for da MESMA conversa
          // Só compara tempo se for de OUTRA conversa
          const isSameConversation = existing?.conversationId === conversationId;

          let shouldUpdate = false;
          if (!existing) {
            // Não existe ainda, criar
            shouldUpdate = true;
          } else if (isSameConversation) {
            // Mesma conversa: SEMPRE atualiza o lastMessage
            shouldUpdate = true;
          } else {
            // Conversa diferente: só atualiza se for mais recente
            const existingTime = existing.lastActivityAt
              ? new Date(existing.lastActivityAt).getTime()
              : 0;
            const incomingTime = new Date(activityTimestamp).getTime();
            shouldUpdate = incomingTime >= existingTime;
          }

          console.log("[VendorRealtime] checking update for client", clientId, {
            existing: !!existing,
            isSameConversation,
            shouldUpdate,
          });

          if (shouldUpdate) {
            next[clientId] = {
              clientId,
              conversationId,
              lastMessage: lastMessageContent,
              lastMessageType,
              lastActivityAt: activityTimestamp,
              lastMessageAt: messageTimestamp,
              unreadCount,
              waitingSince,
              agentLastSeenAt: payload.conversation?.agentLastSeenAt ?? existing?.agentLastSeenAt ?? null,
              status,
              chatbotActive: existing?.chatbotActive ?? false,
              lastMessageStatus: payload.status ?? null,
              contentAttributes: payload.contentAttributes ?? null,
            };
            console.log("[VendorRealtime] UPDATED summary for client", clientId, next[clientId]);
          }
        });
        console.log("[VendorRealtime] returning next with keys:", Object.keys(next));
        return next;
      });
    },
    [resolveConversationClients]
  );

  const handleConversationUpdated = useCallback(
    async (payload: ChatSocketConversation) => {
      const conversationId = payload.conversationId || payload.id;
      console.log("[VendorRealtime] conversation.updated received", {
        conversationId,
        status: payload.status,
        waitingSince: payload.waitingSince,
        unreadCount: payload.unreadCount,
      });

      // Resolver clientes associados a esta conversa
      let clients = await resolveConversationClients(conversationId);

      // Filtrar só os clientes que estão no dashboard (usar ref para ter valor atual)
      const dashboardClientIds = new Set(normalizedClientIdsRef.current);
      clients = clients.filter((id) => dashboardClientIds.has(id));

      if (clients.length === 0) {
        console.log("[VendorRealtime] no matching clients for conversation.updated", conversationId);
        return;
      }

      setSummaryMap((prev) => {
        const next = { ...prev };
        clients.forEach((clientId) => {
          const existing = prev[clientId];

          // conversation.updated SÓ ATUALIZA METADADOS
          // NUNCA atualiza lastMessage (isso é responsabilidade do message.created)
          // Se não existe summary, ignora (vai ser criado pelo message.created ou preload)
          if (!existing) {
            console.log("[VendorRealtime] conversation.updated: no existing summary for client", clientId);
            return;
          }

          const isThisConversation = existing.conversationId === conversationId;

          // Se for de outra conversa, só atualiza se for mais recente
          if (!isThisConversation) {
            const payloadTime = payload.lastActivityAt
              ? new Date(payload.lastActivityAt).getTime()
              : 0;
            const existingTime = existing.lastActivityAt
              ? new Date(existing.lastActivityAt).getTime()
              : 0;
            if (payloadTime < existingTime) {
              console.log("[VendorRealtime] conversation.updated: ignoring older conversation for client", clientId);
              return;
            }
          }

          const status = payload.status ?? existing.status;
          const waitingSince = payload.waitingSince ?? (isThisConversation ? existing.waitingSince : null);

          // Regra: só mostra se está "esperando" (status=open + waitingSince != null)
          const isWaiting = status === "open" && !!waitingSince;
          const unreadCount = isWaiting ? (payload.unreadCount ?? existing.unreadCount) : 0;

          next[clientId] = {
            ...existing,
            // Se for outra conversa E for mais recente, troca para ela
            // MAS não tem lastMessage novo (vai ser null até o preload/message.created)
            conversationId: isThisConversation ? existing.conversationId : conversationId,
            unreadCount,
            lastActivityAt: payload.lastActivityAt ?? existing.lastActivityAt,
            status,
            waitingSince,
            agentLastSeenAt: payload.agentLastSeenAt ?? existing.agentLastSeenAt,
            // Preserva lastMessage existente se for a mesma conversa, ou null se for outra
            lastMessage: isThisConversation ? existing.lastMessage : null,
            lastMessageType: isThisConversation ? existing.lastMessageType : null,
            lastMessageAt: isThisConversation ? existing.lastMessageAt : null,
          };
          console.log("[VendorRealtime] UPDATED after conversation.updated for client", clientId, next[clientId]);
        });
        return next;
      });
    },
    [resolveConversationClients]
  );

  const handleChatbotActive = useCallback(
    async (event: ChatbotSessionEvent) => {
      const conversationId = event?.conversationId;
      if (!conversationId) return;
      let clients = await resolveConversationClients(conversationId);
      const dashboardClientIds = new Set(normalizedClientIdsRef.current);
      clients = clients.filter((id) => dashboardClientIds.has(id));
      if (clients.length === 0) return;

      setSummaryMap((prev) => {
        const next = { ...prev };
        clients.forEach((clientId) => {
          const existing = prev[clientId];
          if (!existing) return;
          if (existing.conversationId !== conversationId) return;
          next[clientId] = { ...existing, chatbotActive: true };
        });
        return next;
      });
    },
    [resolveConversationClients],
  );

  const handleChatbotInactive = useCallback(
    async (event: ChatbotSessionEvent) => {
      const conversationId = event?.conversationId;
      if (!conversationId) return;
      let clients = await resolveConversationClients(conversationId);
      const dashboardClientIds = new Set(normalizedClientIdsRef.current);
      clients = clients.filter((id) => dashboardClientIds.has(id));
      if (clients.length === 0) return;

      setSummaryMap((prev) => {
        const next = { ...prev };
        clients.forEach((clientId) => {
          const existing = prev[clientId];
          if (!existing) return;
          if (existing.conversationId !== conversationId) return;
          next[clientId] = { ...existing, chatbotActive: false };
        });
        return next;
      });
    },
    [resolveConversationClients],
  );

  useChatSocket({
    enabled: normalizedClientIds.length > 0,
    onMessageCreated: handleMessageCreated,
    onMessageUpdated: handleMessageCreated,
    onConversationUpdated: handleConversationUpdated,
  });

  useChatbotSocket({
    enabled: normalizedClientIds.length > 0,
    onActive: handleChatbotActive,
    onInactive: handleChatbotInactive,
  });

  return {
    summariesByClientId: summaryMap,
    summaries: Object.values(summaryMap),
    refresh: preloadSummaries,
  };
}
