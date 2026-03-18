import type { ChatbotPathEvent } from "../path-event";

export interface IChatbotPathEventRepository {
  create(event: Omit<ChatbotPathEvent, "id" | "createdAt">): Promise<ChatbotPathEvent>;
  listBySession(sessionId: string): Promise<ChatbotPathEvent[]>;
  countByFlow(flowId: string): Promise<number>;
}
