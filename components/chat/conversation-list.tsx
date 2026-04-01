"use client";

import { useMemo } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useChat } from "@/lib/chat";
import type { Conversation } from "@/lib/chat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MessageSquare, Bot } from "lucide-react";

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

const ASSIGNEE_DOT_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-pink-500", "bg-sky-500", "bg-orange-400", "bg-teal-500",
  "bg-rose-500", "bg-indigo-500",
];

function getAssigneeDotColor(name: string): string {
  const hash = name.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  return ASSIGNEE_DOT_COLORS[Math.abs(hash) % ASSIGNEE_DOT_COLORS.length];
}

function getInitials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const CRM_STAGES: Record<number, { label: string, color: string }> = {
  0: { label: "A fazer contato", color: "bg-slate-100 text-slate-600 border-slate-200" },
  1: { label: "Contato feito", color: "bg-blue-100 text-blue-700 border-blue-200" },
  2: { label: "Follow-up 1", color: "bg-amber-100 text-amber-700 border-amber-200" },
  3: { label: "Follow-up 2", color: "bg-orange-100 text-orange-700 border-orange-200" },
  4: { label: "Ignorado", color: "bg-red-100 text-red-700 border-red-200" },
  5: { label: "Interessado", color: "bg-purple-100 text-purple-700 border-purple-200" },
  6: { label: "Negociando", color: "bg-sky-100 text-sky-700 border-sky-200" },
  7: { label: "Venda Feita", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  8: { label: "Perdido", color: "bg-rose-100 text-rose-700 border-rose-200" },
};

function getCrmStage(conversation: Conversation) {
  // Tentar pegar do primeiro cliente vinculado ao contato
  const client = conversation.contact?.clients?.[0];
  const code = (client as any)?.kanbanEstado?.code ?? 0;

  return CRM_STAGES[code] || CRM_STAGES[0];
}

// ════════════════════════════════════════════════════════════════════════════
// CONVERSATION ITEM
// ════════════════════════════════════════════════════════════════════════════

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  showAiOnly: boolean;
}

function ConversationItem({ conversation, isActive, onClick, showAiOnly }: ConversationItemProps) {
  const contactName = conversation.contact?.name || conversation.contact?.phoneNumber || "Desconhecido";
  const initials = getInitials(contactName);
  const assigneeName = conversation.assignee?.name ?? "";

  // Todos os derived values antes de qualquer return condicional
  const hasAi = conversation.chatbotStatus === "ACTIVE";
  const unreadCount = conversation.unreadCount || 0;
  const crmStage = getCrmStage(conversation);

  const lastMessagePreview = useMemo(() => {
    const msg = conversation.lastMessage;
    if (!msg) return "Sem mensagens";
    if (msg.contentType === "text") return msg.content || "Mensagem";
    if (msg.contentType === "template") return msg.content || "[Mensagem enviada]";
    if (msg.contentType === "image") return "🖼️ Imagem";
    if (msg.contentType === "audio") return "🎵 Áudio";
    if (msg.contentType === "video") return "🎬 Vídeo";
    if (msg.contentType === "contact") return "👤 Contato";
    if (msg.contentType === "location") return "📍 Localização";
    if (msg.contentType === "document" || msg.contentType === "file") return "📄 Documento";
    if (msg.contentType === "sticker") return "😄 Figurinha";
    return msg.content || `[${msg.contentType}]`;
  }, [conversation.lastMessage]);

  const timeDisplay = useMemo(() => {
    const dateValue = conversation.lastMessage?.createdAt || conversation.lastActivityAt;
    if (!dateValue) return "";
    try {
      const date = new Date(dateValue);
      if (isToday(date)) return format(date, "HH:mm");
      if (isYesterday(date)) return "Ontem";
      return format(date, "d MMM", { locale: ptBR });
    } catch { return ""; }
  }, [conversation.lastMessage?.createdAt, conversation.lastActivityAt]);

  // Filtro IA — depois de todos os hooks/memos
  if (showAiOnly && !hasAi) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-3 py-3 transition-colors text-left relative border-b border-border/50",
        isActive
          ? "bg-primary/8"
          : "hover:bg-muted/50"
      )}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-primary rounded-r-full" />
      )}

      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar className="h-10 w-10 rounded-full">
            <AvatarFallback className={cn(
              "text-[11px] font-semibold",
              isActive ? "bg-primary/15 text-primary" : "bg-blue-600 text-white"
            )}>
              {initials}
            </AvatarFallback>
          </Avatar>
          {hasAi && (
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-orange-500 rounded-full border-2 border-white" />
          )}
          {unreadCount > 0 && (
            <div className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white border-2 border-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <h3 className={cn(
              "text-[13px] font-semibold truncate leading-none",
              isActive ? "text-primary" : "text-foreground"
            )}>
              {contactName}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {assigneeName && (
                <span
                  title={assigneeName}
                  className={cn(
                    "h-4 w-4 rounded-full shrink-0 cursor-default flex items-center justify-center text-[8px] font-bold text-white leading-none",
                    getAssigneeDotColor(assigneeName)
                  )}
                >
                  {getInitials(assigneeName)}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                {timeDisplay}
              </span>
            </div>
          </div>

          <p className="text-[12px] text-muted-foreground truncate leading-normal mb-1">
            {lastMessagePreview}
          </p>

          {/* Metadata row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {hasAi && (
              <span className="text-[11px] text-orange-500 font-medium flex items-center gap-0.5">
                <Bot className="h-2.5 w-2.5" />
                IA
              </span>
            )}
            {hasAi && (
              <span className="text-muted-foreground/30 text-[10px]">·</span>
            )}
            <span className={cn(
              "inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border",
              crmStage.color
            )}>
              {crmStage.label}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SKELETON
// ════════════════════════════════════════════════════════════════════════════

function ConversationSkeleton() {
  return (
    <div className="px-3 py-2 flex items-center gap-2.5">
      <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-2.5 w-1/2" />
        <Skeleton className="h-2 w-full" />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CONVERSATION LIST
// ════════════════════════════════════════════════════════════════════════════

export function ConversationList({ showAiOnly = false }: { showAiOnly?: boolean }) {
  const { state, selectConversation, loadMoreConversations } = useChat();
  const {
    conversations = [],
    activeConversationId,
    isLoadingConversations,
    conversationsMeta,
  } = state;

  const hasMore = conversationsMeta?.hasMore ?? false;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    if (nearBottom && hasMore && !isLoadingConversations) {
      loadMoreConversations();
    }
  };

  if (isLoadingConversations && conversations.length === 0) {
    return (
      <div className="pt-1">
        {[...Array(8)].map((_, i) => <ConversationSkeleton key={i} />)}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-8 gap-3">
        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">Nenhuma conversa</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">As conversas aparecerão aqui.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" onScroll={handleScroll}>
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isActive={conversation.id === activeConversationId}
          onClick={() => selectConversation(conversation.id)}
          showAiOnly={showAiOnly}
        />
      ))}
      {isLoadingConversations && <ConversationSkeleton />}
    </div>
  );
}
