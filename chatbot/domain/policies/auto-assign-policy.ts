import type { ChatbotFlow } from "../flow";
import type { ChatbotSession } from "../session";

type AutoAssignContext = {
  isNewConversation: boolean;
  isReopenedConversation: boolean;
  defaultActive: boolean;
  flow: ChatbotFlow | null;
  existingSession: ChatbotSession | null;
  now: Date;
};

export class AutoAssignChatbotPolicy {
  shouldAutoAssign(context: AutoAssignContext): boolean {
    console.log(context)

    // REGRA PRINCIPAL: Só dispara chatbot se for conversa NOVA ou REABERTA de resolvida
    if (!context.isNewConversation && !context.isReopenedConversation) {
      return false;
    }

    if (!context.defaultActive) return false;
    if (!context.flow || !context.flow.active || context.flow.type !== "INBOUND") {
      return false;
    }

    const existing = context.existingSession;
    if (!existing) return true;
    if (existing.status === "ACTIVE") return false;

    return true;
  }
}
