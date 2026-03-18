import type { IChatbotSessionRepository } from "../domain/repositories/session-repository";
import type { IChatbotStatusEmitter } from "./ports/chatbot-status-emitter";

type UnassignChatbotInput = {
  conversationId: string;
};

export class UnassignChatbotUseCase {
  constructor(
    private readonly sessionRepository: IChatbotSessionRepository,
    private readonly statusEmitter?: IChatbotStatusEmitter
  ) {}

  async execute(input: UnassignChatbotInput) {
    const session = await this.sessionRepository.findActiveByConversation(
      input.conversationId
    );
    if (!session) return null;

    const updated = await this.sessionRepository.update(session.id, {
      status: "PAUSED",
      lastInteractionAt: new Date(),
    });
    if (this.statusEmitter) {
      await this.statusEmitter.emitInactive({
        conversationId: input.conversationId,
        sessionId: session.id,
        flowId: session.flowId,
        reason: "UNASSIGNED",
      });
    }
    return updated;
  }
}
