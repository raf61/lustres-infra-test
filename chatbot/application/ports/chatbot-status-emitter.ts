export type ChatbotStatusEvent = {
  conversationId: string;
  sessionId?: string | null;
  flowId?: string | null;
  inboxId?: string | null;
  reason?: string;
};

export interface IChatbotStatusEmitter {
  emitActive(input: ChatbotStatusEvent): Promise<void>;
  emitInactive(input: ChatbotStatusEvent): Promise<void>;
  bulkEmitActive(inputs: ChatbotStatusEvent[]): Promise<void>;
}
