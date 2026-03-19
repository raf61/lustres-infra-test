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
import { MessageSquare, Bot, User } from "lucide-react";

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

function getInitials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const CRM_STAGES: Record<number, { label: string, color: string }> = {
  0: { label: "A fazer contato", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  1: { label: "Contato feito", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  2: { label: "Follow-up 1", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  3: { label: "Follow-up 2", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  4: { label: "Ignorado", color: "bg-red-500/20 text-red-500 border-red-500/30" },
  5: { label: "Interessado", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  6: { label: "Negociando", color: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  7: { label: "Venda Feita", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  8: { label: "Perdido", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
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
    if (msg.contentType === "image") return "[Imagem]";
    if (msg.contentType === "audio") return "[Áudio]";
    if (msg.contentType === "video") return "[Vídeo]";
    if (msg.contentType === "contact") return "[Contato]";
    if (msg.contentType === "location") return "[Localização]";
    if (msg.contentType === "document" || msg.contentType === "file") return "[Arquivo]";
    if (msg.contentType === "sticker") return "[Figurinha]";
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
        "w-full px-3 py-2 border-b border-border/40 transition-all text-left",
        "hover:bg-primary/5",
        isActive
          ? "bg-primary/10 border-l-2 border-l-primary"
          : "border-l-2 border-l-transparent"
      )}
    >
      <div className="flex items-center gap-2.5">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar className={cn(
            "h-9 w-9 rounded-xl shadow ring-1 transition-all",
            isActive ? "ring-primary" : hasAi ? "ring-orange-500/50" : "ring-border/60"
          )}>
            <AvatarFallback className={cn(
              "font-semibold text-[10px]",
              isActive ? "bg-primary text-white" : "bg-card text-foreground"
            )}>
              {initials}
            </AvatarFallback>
          </Avatar>

          {hasAi && (
            <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-orange-500 rounded-md flex items-center justify-center shadow border border-background">
              <Bot className="h-2 w-2 text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <h3 className={cn(
              "text-xs font-semibold truncate",
              isActive ? "text-primary" : "text-foreground"
            )}>
              {contactName}
            </h3>
            <span className="text-[9px] text-muted-foreground/50 shrink-0 whitespace-nowrap">
              {timeDisplay}
            </span>
          </div>

          <p className="text-xs text-muted-foreground truncate leading-snug mb-1.5">
            {lastMessagePreview}
          </p>

          {/* Badges */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              {assigneeName && (
                <Badge variant="outline" className="h-4 px-1.5 text-[8px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0">
                  <User className="h-1.5 w-1.5 mr-0.5" />
                  {assigneeName.split(" ")[0]}
                </Badge>
              )}
              {hasAi && (
                <Badge variant="outline" className="h-4 px-1.5 text-[8px] font-bold uppercase tracking-widest bg-orange-500/10 text-orange-400 border-orange-500/20 shrink-0 flex items-center gap-0.5">
                  <Bot className="h-2.5 w-2.5" />
                  IA
                </Badge>
              )}
              <Badge variant="outline" className={cn("h-4 px-1.5 text-[8px] font-bold uppercase tracking-widest border shrink-0 whitespace-nowrap", crmStage.color)}>
                {crmStage.label}
              </Badge>
            </div>

            {unreadCount > 0 && (
              <div className="h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full bg-primary text-[8px] font-black text-white shadow shrink-0 ml-1">
                {unreadCount}
              </div>
            )}
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
      <div className="flex flex-col items-center justify-center h-64 p-8 space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-muted/20 flex items-center justify-center">
          <MessageSquare className="h-7 w-7 text-muted-foreground/30" />
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Fila vazia</p>
          <p className="text-[9px] text-muted-foreground/40 uppercase tracking-tight mt-1">As conversas aparecerão aqui.</p>
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
