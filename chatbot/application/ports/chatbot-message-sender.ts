export type ChatbotSendMessageInput = {
  conversationId: string;
  content?: string;
  contentType?: string;
  messageType?: "outgoing" | "template";
  contentAttributes?: {
    items?: Array<{ title: string; value: string; description?: string }>;
    template?: { name: string; languageCode: string; components: any[] };
    ignoreWaitingSince?: boolean;
    keepChatbot?: boolean;
  };
  attachments?: Array<{
    fileType: string;
    fileUrl: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  }>;
};

export interface IChatbotMessageSender {
  send(input: ChatbotSendMessageInput): Promise<{ messageId: string }>;
}
