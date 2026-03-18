import type { IChatbotFlowRepository } from "../domain/repositories/flow-repository";
import type { IChatbotSessionRepository } from "../domain/repositories/session-repository";
import type { IChatbotStatusEmitter } from "./ports/chatbot-status-emitter";

type AssignChatbotInput = {
  conversationId: string;
  flowId: string;
};

export class AssignChatbotUseCase {
  constructor(
    private readonly flowRepository: IChatbotFlowRepository,
    private readonly sessionRepository: IChatbotSessionRepository,
    private readonly statusEmitter?: IChatbotStatusEmitter
  ) {}

  async execute(input: AssignChatbotInput) {
    const flow = await this.flowRepository.findById(input.flowId);
    if (!flow || !flow.active || flow.type !== "INBOUND") {
      throw new Error("FLOW_NOT_FOUND");
    }

    const existing = await this.sessionRepository.findActiveByConversation(
      input.conversationId
    );
    if (existing && existing.flowId === flow.id) {
      return existing;
    }

    const session = await this.sessionRepository.create({
      conversationId: input.conversationId,
      flowId: flow.id,
      status: "ACTIVE",
      currentStepId: null,
      variables: {},
      lastInteractionAt: new Date(),
    });
    if (this.statusEmitter) {
      await this.statusEmitter.emitActive({
        conversationId: input.conversationId,
        sessionId: session.id,
        flowId: flow.id,
      });
    }
    return session;
  }
}
