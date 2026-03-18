import type { ChatbotSession } from "../session";

export interface IChatbotSessionRepository {
  findById(id: string): Promise<ChatbotSession | null>;
  findActiveByConversation(conversationId: string): Promise<ChatbotSession | null>;
  findLatestByConversation(conversationId: string): Promise<ChatbotSession | null>;
  pauseActiveByConversation(conversationId: string): Promise<void>;
  create(data: Omit<ChatbotSession, "id" | "createdAt" | "updatedAt">): Promise<ChatbotSession>;
  update(id: string, data: Partial<ChatbotSession>): Promise<ChatbotSession>;
}
