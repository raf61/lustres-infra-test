import type { ChatbotFlowDefinition } from "../domain/flow";
import type { IChatbotPathEventRepository } from "../domain/repositories/path-event-repository";
import type { IChatbotMessageSender } from "./ports/chatbot-message-sender";
import type { IChatbotActionProvider } from "./ports/action-provider";
import { executeStep, findStep } from "./step-handlers";
import { interpolateVariables } from "./utils/variable-parser";
import { getMaxStepsPerRun } from "./utils/session-timeout";

export type RunUntilInputResult = {
  messageIds: string[];
  status: "ACTIVE" | "COMPLETED" | "PAUSED";
  currentStepId: string | null;
  variables: Record<string, unknown>;
  handoff?: boolean;
};

export class FlowRunner {
  constructor(
    private readonly pathEventRepository: IChatbotPathEventRepository,
    private readonly messageSender: IChatbotMessageSender,
    private readonly actionProvider: IChatbotActionProvider
  ) { }

  async runUntilInput(params: {
    sessionId: string;
    conversationId: string;
    flowId: string;
    definition: ChatbotFlowDefinition;
    stepId: string;
    variables: Record<string, unknown>;
  }): Promise<RunUntilInputResult> {
    const { sessionId, conversationId, flowId, definition } = params;
    let currentStepId: string | null | undefined = params.stepId;
    let vars = { ...params.variables };
    let isHandoff = false;
    const pendingMessages: any[] = [];
    const maxSteps = getMaxStepsPerRun(definition);
    let stepsExecuted = 0;

    const actionDependencies = {
      executeAction: (actionName: string, variables: Record<string, unknown>) =>
        this.actionProvider.execute(actionName, variables, { conversationId }),
    };

    while (currentStepId) {
      stepsExecuted += 1;
      if (stepsExecuted > maxSteps) {
        return this.finishTurn(pendingMessages, "PAUSED", currentStepId, vars, isHandoff, conversationId);
      }

      const step = findStep(definition, currentStepId);
      if (!step) break;

      await this.pathEventRepository.create({
        sessionId,
        stepId: step.id,
        eventType: "ENTERED",
        payload: { flowId },
      });

      const result = await executeStep(step, vars, actionDependencies);
      if (result.handoff) isHandoff = true;

      if (result.variableUpdates) {
        vars = { ...vars, ...result.variableUpdates };
      }

      for (const message of result.outgoingMessages) {
        pendingMessages.push({
          conversationId,
          content: message.content,
          contentType: message.contentType,
          messageType: message.messageType,
          contentAttributes: message.contentAttributes,
          attachments: message.attachments,
        });
      }

      await this.pathEventRepository.create({
        sessionId,
        stepId: step.id,
        eventType: "EXITED",
        payload: { flowId },
      });

      if (step.type === "input" || step.type === "wait") {
        return this.finishTurn(pendingMessages, "ACTIVE", step.id, vars, isHandoff, conversationId);
      }

      currentStepId = result.nextStepId ?? null;
    }

    return this.finishTurn(pendingMessages, "COMPLETED", null, vars, isHandoff, conversationId);
  }

  private async finishTurn(
    pendingMessages: any[],
    status: RunUntilInputResult["status"],
    currentStepId: string | null,
    variables: Record<string, unknown>,
    handoff: boolean,
    conversationId: string
  ): Promise<RunUntilInputResult> {
    const messageIds: string[] = [];

    for (let i = 0; i < pendingMessages.length; i++) {
      const msg = pendingMessages[i];
      const sent = await this.messageSender.send({
        ...msg,
        contentAttributes: {
          ...msg.contentAttributes,
          ignoreWaitingSince: handoff || msg.contentAttributes?.ignoreWaitingSince,
        },
      });
      messageIds.push(sent.messageId);

      // Delay entre mensagens para garantir ordem de entrega
      if (i < pendingMessages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return {
      messageIds,
      status,
      currentStepId,
      variables,
      handoff,
    };
  }
}
