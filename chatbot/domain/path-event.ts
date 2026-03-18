export type ChatbotPathEventType =
  | "ENTERED"
  | "EXITED"
  | "INVALID_INPUT"
  | "CONDITION"
  | "EXPIRED"
  | "DISABLED_BY_AGENT";

export type ChatbotPathEvent = {
  id: string;
  sessionId: string;
  stepId?: string | null;
  eventType: ChatbotPathEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
};
