"use client";

import { useEffect } from "react";
import { ChatProviderAuto, useChat } from "@/lib/chat";
import { ChatbotProvider } from "@/lib/chatbot";
import { ChatConversationPane } from "./chat-conversation-pane";

type ChatMiniPanelProps = {
  conversationId: string;
};

function ChatMiniPanelContent({ conversationId }: ChatMiniPanelProps) {
  const { openConversationById } = useChat();

  useEffect(() => {
    if (conversationId) {
      openConversationById(conversationId).catch(console.error);
    }
  }, [conversationId, openConversationById]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatConversationPane />
    </div>
  );
}

export function ChatMiniPanel({ conversationId }: ChatMiniPanelProps) {
  return (
    <ChatProviderAuto>
      <ChatbotProvider>
        <ChatMiniPanelContent conversationId={conversationId} />
      </ChatbotProvider>
    </ChatProviderAuto>
  );
}

