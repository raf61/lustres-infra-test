import type { IChatbotSessionRepository } from "../domain/repositories/session-repository";
import type { IChatbotPathEventRepository } from "../domain/repositories/path-event-repository";
import type { IChatbotStatusEmitter } from "./ports/chatbot-status-emitter";

type DisableInput = {
  conversationId: string;
  senderId: string;
};

export class DisableChatbotOnAgentMessageUseCase {
  constructor(
    private readonly sessionRepository: IChatbotSessionRepository,
    private readonly pathEventRepository: IChatbotPathEventRepository,
    private readonly statusEmitter?: IChatbotStatusEmitter
  ) {}

  async execute(input: DisableInput) {
    const session = await this.sessionRepository.findActiveByConversation(
      input.conversationId
    );
    if (!session) return null;

    await this.pathEventRepository.create({
      sessionId: session.id,
      stepId: session.currentStepId ?? undefined,
      eventType: "DISABLED_BY_AGENT",
      payload: { senderId: input.senderId },
    });

    const updated = await this.sessionRepository.update(session.id, {
      status: "PAUSED",
      currentStepId: null,
      lastInteractionAt: new Date(),
    });
    if (this.statusEmitter) {
      await this.statusEmitter.emitInactive({
        conversationId: input.conversationId,
        sessionId: session.id,
        flowId: session.flowId,
        reason: "DISABLED_BY_AGENT",
      });
    }
    return updated;
  }
}
