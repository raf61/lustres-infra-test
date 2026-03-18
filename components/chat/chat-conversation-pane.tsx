"use client";

import { ChatHeader } from "./chat-header";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";

// Área principal da conversa (header + mensagens + input)
export function ChatConversationPane() {
  return (
    <>
      <div className="flex-shrink-0">
        <ChatHeader />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <MessageList />
      </div>
      <div className="flex-shrink-0">
        <MessageInput />
      </div>
    </>
  );
}


