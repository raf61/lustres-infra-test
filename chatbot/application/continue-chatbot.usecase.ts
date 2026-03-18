import type { ChatbotSession } from "../domain/session";
import type { IChatbotFlowRepository } from "../domain/repositories/flow-repository";
import type { IChatbotSessionRepository } from "../domain/repositories/session-repository";
import type { IChatbotPathEventRepository } from "../domain/repositories/path-event-repository";
import type { IChatbotMessageSender } from "./ports/chatbot-message-sender";
import type { IChatbotStatusEmitter } from "./ports/chatbot-status-emitter";
import type { IChatbotActionProvider } from "./ports/action-provider";
import { executeStep, findStep, resolveNextStepByOptions } from "./step-handlers";
import { interpolateVariables } from "./utils/variable-parser";
import { validateInput } from "./utils/input-validator";
import { getSessionTimeoutMinutes, shouldExpireSession } from "./utils/session-timeout";
import { FlowRunner } from "./flow-runner";

type ContinueChatbotInput = {
  conversationId: string;
  incomingMessage: string;
  interactiveId?: string | null;
};

export class ContinueChatbotUseCase {
  constructor(
    private readonly flowRepository: IChatbotFlowRepository,
    private readonly sessionRepository: IChatbotSessionRepository,
    private readonly pathEventRepository: IChatbotPathEventRepository,
    private readonly messageSender: IChatbotMessageSender,
    private readonly actionProvider: IChatbotActionProvider,
    private readonly statusEmitter?: IChatbotStatusEmitter
  ) { }

  async execute(input: ContinueChatbotInput): Promise<{ session: ChatbotSession; handoff?: boolean } | null> {
    const session = await this.sessionRepository.findActiveByConversation(
      input.conversationId
    );
    if (!session || session.status !== "ACTIVE") return null;

    const flow = await this.flowRepository.findById(session.flowId);
    if (!flow || !flow.active) return null;

    // Se for AI Agent, ignora (será processado pelo worker dedicado)
    if (flow.engine === "AI_AGENT") return null;

    const timeoutMinutes = getSessionTimeoutMinutes(flow.definition);
    if (shouldExpireSession(timeoutMinutes, new Date(), session.lastInteractionAt)) {
      await this.pathEventRepository.create({
        sessionId: session.id,
        stepId: session.currentStepId ?? undefined,
        eventType: "EXPIRED",
        payload: { flowId: flow.id },
      });
      await this.sessionRepository.update(session.id, {
        status: "PAUSED",
        currentStepId: null,
        lastInteractionAt: new Date(),
      });
      if (this.statusEmitter) {
        await this.statusEmitter.emitInactive({
          conversationId: input.conversationId,
          sessionId: session.id,
          flowId: flow.id,
          reason: "EXPIRED",
        });
      }
      return null;
    }

    const definition = flow.definition;
    const currentStep = findStep(definition, session.currentStepId);
    if (!currentStep) return null;

    if (currentStep.type === "wait") {
      await this.pathEventRepository.create({
        sessionId: session.id,
        stepId: currentStep.id,
        eventType: "EXITED",
        payload: { flowId: flow.id },
      });

      const nextStepId = currentStep.nextStepId ?? null;
      if (!nextStepId) {
        await this.sessionRepository.update(session.id, {
          status: "COMPLETED",
          currentStepId: null,
          variables: session.variables,
          lastInteractionAt: new Date(),
        });
        return { session, handoff: false };
      }

      const runner = new FlowRunner(this.pathEventRepository, this.messageSender, this.actionProvider);
      const result = await runner.runUntilInput({
        sessionId: session.id,
        conversationId: input.conversationId,
        flowId: flow.id,
        definition,
        stepId: nextStepId,
        variables: session.variables,
      });

      const finalStatus = result.handoff ? "PAUSED" : result.status;

      await this.sessionRepository.update(session.id, {
        status: finalStatus,
        currentStepId: result.currentStepId,
        variables: result.variables,
        lastInteractionAt: new Date(),
      });

      if (result.handoff && this.statusEmitter) {
        await this.statusEmitter.emitInactive({
          conversationId: input.conversationId,
          sessionId: session.id,
          flowId: flow.id,
          reason: "handoff",
        });
      }

      return { session, handoff: result.handoff };
    }

    if (currentStep.type !== "input") {
      return null;
    }

    const { isValid, parsedValue } = validateInput(
      currentStep,
      input.incomingMessage,
      input.interactiveId
    );
    if (!isValid) {
      await this.pathEventRepository.create({
        sessionId: session.id,
        stepId: currentStep.id,
        eventType: "INVALID_INPUT",
        payload: { value: input.incomingMessage },
      });

      // Se o step estiver configurado para fazer handoff em caso de input inválido
      if (currentStep.handoffOnInvalid) {
        const maxAttempts = currentStep.maxInvalidAttempts ?? 0;
        const attemptKey = `_attempts_${currentStep.id}`;
        const currentAttempts = (session.variables[attemptKey] as number) ?? 0;

        // Se tem limite de tentativas e ainda não atingiu
        if (maxAttempts > 0 && currentAttempts < maxAttempts) {
          // Incrementa contador
          const newAttempts = currentAttempts + 1;
          await this.sessionRepository.update(session.id, {
            variables: { ...session.variables, [attemptKey]: newAttempts },
            lastInteractionAt: new Date(),
          });

          // Envia mensagem de retry
          const retryMessage = `Opção inválida. Por favor, escolha uma das opções disponíveis. (Tentativa ${newAttempts} de ${maxAttempts})`;
          await this.messageSender.send({
            conversationId: session.conversationId,
            content: retryMessage,
            contentType: "text",
            messageType: "outgoing",
            contentAttributes: { ignoreWaitingSince: true },
          });

          // Retorna null para não avançar o fluxo
          return null;
        }

        // Atingiu o limite ou não tem limite configurado → Handoff
        const now = new Date();
        await this.sessionRepository.update(session.id, {
          status: "PAUSED",
          currentStepId: null,
          lastInteractionAt: now,
        });
        return {
          session: { ...session, status: "PAUSED", currentStepId: null, lastInteractionAt: now },
          handoff: true
        };
      }

      const failStepId = currentStep.onFailStepId ?? currentStep.id;
      const failStep = findStep(definition, failStepId);
      if (failStep) {
        const actionDependencies = {
          executeAction: (actionName: string, variables: Record<string, unknown>) =>
            this.actionProvider.execute(actionName, variables, { conversationId: input.conversationId }),
        };
        const failResult = await executeStep(failStep, session.variables, actionDependencies);
        for (const message of failResult.outgoingMessages) {
          await this.messageSender.send({
            conversationId: input.conversationId,
            content: message.content
              ? interpolateVariables(message.content, session.variables)
              : undefined,
            contentType: message.contentType,
            messageType: message.messageType,
            contentAttributes: message.contentAttributes,
            attachments: message.attachments,
          });
        }
      }

      await this.sessionRepository.update(session.id, {
        currentStepId: currentStep.id,
        lastInteractionAt: new Date(),
      });
      return { session, handoff: false };
    }

    const variables = { ...session.variables };
    if (currentStep.saveTo) {
      variables[currentStep.saveTo] = parsedValue;
    } else {
      variables[currentStep.id] = parsedValue;
    }

    // Resetar contador de tentativas quando input é válido
    const attemptKey = `_attempts_${currentStep.id}`;
    if (variables[attemptKey]) {
      delete variables[attemptKey];
    }

    await this.pathEventRepository.create({
      sessionId: session.id,
      stepId: currentStep.id,
      eventType: "EXITED",
      payload: { value: parsedValue },
    });

    const nextStepId = resolveNextStepByOptions(
      currentStep,
      input.incomingMessage,
      input.interactiveId
    );
    if (!nextStepId) {
      await this.sessionRepository.update(session.id, {
        status: "COMPLETED",
        currentStepId: null,
        variables,
        lastInteractionAt: new Date(),
      });
      if (this.statusEmitter) {
        await this.statusEmitter.emitInactive({
          conversationId: input.conversationId,
          sessionId: session.id,
          flowId: flow.id,
          reason: "COMPLETED",
        });
      }
      return { session, handoff: false };
    }

    const runner = new FlowRunner(this.pathEventRepository, this.messageSender, this.actionProvider);
    const result = await runner.runUntilInput({
      sessionId: session.id,
      conversationId: input.conversationId,
      flowId: flow.id,
      definition,
      stepId: nextStepId,
      variables,
    });

    const finalStatus = result.handoff ? "PAUSED" : result.status;

    await this.sessionRepository.update(session.id, {
      status: finalStatus,
      currentStepId: result.currentStepId,
      variables: result.variables,
      lastInteractionAt: new Date(),
    });

    if (result.handoff && this.statusEmitter) {
      await this.statusEmitter.emitInactive({
        conversationId: input.conversationId,
        sessionId: session.id,
        flowId: flow.id,
        reason: "handoff",
      });
    }

    return { session, handoff: result.handoff };
  }

}
