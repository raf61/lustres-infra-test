import type { ChatbotFlow } from "../flow";

export interface IChatbotFlowRepository {
  findById(id: string): Promise<ChatbotFlow | null>;
  list(params?: { active?: boolean; type?: string }): Promise<ChatbotFlow[]>;
  create(data: Omit<ChatbotFlow, "id" | "createdAt" | "updatedAt">): Promise<ChatbotFlow>;
  update(
    id: string,
    data: Partial<Omit<ChatbotFlow, "id" | "createdAt" | "updatedAt">>
  ): Promise<ChatbotFlow>;
  delete(id: string): Promise<void>;
}
