"use client";

import { useState } from "react";

import { ChatProvider } from "@/lib/chat";
import { ChatbotProvider } from "@/lib/chatbot";
import { ConversationList } from "./conversation-list";
import { ChatConversationPane } from "./chat-conversation-pane";
import { ChatFilters } from "./chat-filters";
import { ChatSidebar } from "./chat-sidebar";
import { cn } from "@/lib/utils";

// ════════════════════════════════════════════════════════════════════════════
// CHAT PANEL (Componente Principal)
// ════════════════════════════════════════════════════════════════════════════

function ChatPanelContent() {
  const [showAiOnly, setShowAiOnly] = useState(false);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[hsl(215_30%_94%)]">
      {/* Sidebar Esquerda - Lista de Conversas */}
      <div className="w-[340px] flex-shrink-0 flex flex-col min-h-0 border-r border-border bg-white shadow-sm">
        {/* Filtros - altura fixa */}
        <div className="flex-shrink-0">
          <ChatFilters onAiFilterChange={setShowAiOnly} />
        </div>
        {/* Lista - flex-1 para ocupar o resto */}
        <div className="flex-1 min-h-0">
          <ConversationList showAiOnly={showAiOnly} />
        </div>
      </div>

      {/* Main - Área de Chat */}
      <div className="flex-1 flex flex-col min-h-0 bg-[hsl(215_30%_94%)] relative overflow-hidden">
        <ChatConversationPane />
      </div>

      {/* Sidebar Direita - CRM Context */}
      <div id="chat-crm-sidebar" className="flex-shrink-0 hidden xl:flex">
        <ChatSidebar />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORT COM PROVIDER
// ════════════════════════════════════════════════════════════════════════════

export function ChatPanel() {
  return (
    <ChatProvider>
      <ChatbotProvider>
        <ChatPanelContent />
      </ChatbotProvider>
    </ChatProvider>
  );
}
