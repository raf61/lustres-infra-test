export type ChatbotSessionStatus = "ACTIVE" | "PAUSED" | "COMPLETED";

export type ChatbotSession = {
  id: string;
  conversationId: string;
  flowId: string;
  status: ChatbotSessionStatus;
  currentStepId?: string | null;
  variables: Record<string, unknown>;
  lastInteractionAt?: Date | null;
  conversationSummary?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
