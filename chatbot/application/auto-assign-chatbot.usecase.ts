import type { IChatbotInboxDefaultRepository } from "../domain/repositories/inbox-default-repository";
import type { IChatbotSessionRepository } from "../domain/repositories/session-repository";
import type { IChatbotFlowRepository } from "../domain/repositories/flow-repository";
import type { IConversationRepository } from "../../chat/domain/repositories/conversation-repository";
import { StartChatbotUseCase } from "./start-chatbot.usecase";
import { AutoAssignChatbotPolicy } from "../domain/policies/auto-assign-policy";

type AutoAssignInput = {
  conversationId: string;
  inboxId: string;
  isNewConversation?: boolean;
  isReopenedConversation?: boolean;
};

export class AutoAssignChatbotUseCase {
  constructor(
    private readonly inboxDefaultRepository: IChatbotInboxDefaultRepository,
    private readonly sessionRepository: IChatbotSessionRepository,
    private readonly flowRepository: IChatbotFlowRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly startChatbotUseCase: StartChatbotUseCase,
    private readonly policy: AutoAssignChatbotPolicy = new AutoAssignChatbotPolicy()
  ) { }

  async execute(input: AutoAssignInput) {
    const existing = await this.sessionRepository.findLatestByConversation(
      input.conversationId
    );

    const conversation = await this.conversationRepository.findById(
      input.conversationId
    );
    if (!conversation) return null;

    const defaultConfig = await this.inboxDefaultRepository.findDefaultByInbox(
      input.inboxId
    );

    if (!defaultConfig) return { session: existing ?? null, started: false };

    const flow = await this.flowRepository.findById(defaultConfig.flowId);
    const canAssign = this.policy.shouldAutoAssign({
      isNewConversation: Boolean(input.isNewConversation),
      isReopenedConversation: Boolean(input.isReopenedConversation),
      defaultActive: defaultConfig.active,
      flow,
      existingSession: existing,
      now: new Date(),
    });
    console.log("canAssign", canAssign);
    if (!canAssign || !flow) {
      return { session: existing ?? null, started: false };
    }

    const result = await this.startChatbotUseCase.execute({
      conversationId: input.conversationId,
      flowId: flow.id,
    });
    return { session: result.session, started: true };
  }
}
