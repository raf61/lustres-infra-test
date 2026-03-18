import type { IChatbotFlowRepository } from "../domain/repositories/flow-repository";
import type { IChatbotSessionRepository } from "../domain/repositories/session-repository";
import type { ChatbotSession } from "../domain/session";
import type { ChatbotFlowDefinition } from "../domain/flow";
import type { IChatbotPathEventRepository } from "../domain/repositories/path-event-repository";
import type { IChatbotMessageSender } from "./ports/chatbot-message-sender";
import type { IChatbotStatusEmitter } from "./ports/chatbot-status-emitter";
import type { IChatbotActionProvider } from "./ports/action-provider";
import { FlowRunner } from "./flow-runner";

type StartChatbotInput = {
  conversationId: string;
  flowId: string;
  initialVariables?: Record<string, unknown>;
  definitionOverride?: ChatbotFlowDefinition;
};

export class StartChatbotUseCase {
  constructor(
    private readonly flowRepository: IChatbotFlowRepository,
    private readonly sessionRepository: IChatbotSessionRepository,
    private readonly pathEventRepository: IChatbotPathEventRepository,
    private readonly messageSender: IChatbotMessageSender,
    private readonly actionProvider: IChatbotActionProvider,
    private readonly statusEmitter?: IChatbotStatusEmitter
  ) { }

  async execute(input: StartChatbotInput): Promise<{ session: ChatbotSession; messageIds: string[] }> {

    const flow = await this.flowRepository.findById(input.flowId);
    console.log("flow", flow, input.flowId);

    if (!flow || !flow.active) {
      throw new Error("FLOW_NOT_FOUND");
    }
    // 1. Garantir que outras sessões ativas sejam pausadas para evitar duplicidade ou conflito
    await this.sessionRepository.pauseActiveByConversation(input.conversationId);

    // Se for AI Agent (ou se tiver aiConfig, sinalizando que deve ser tratado como tal) cria sessão e retorna
    if (flow.engine === "AI_AGENT" || (flow as any).aiConfig) {
      const session = await this.sessionRepository.create({
        conversationId: input.conversationId,
        flowId: flow.id,
        status: "ACTIVE",
        currentStepId: null,
        variables: input.initialVariables ?? {},
        lastInteractionAt: new Date(),
        conversationSummary: null,
      });
      console.log(`[StartChatbotUseCase] AI Agent session created: ${session.id}`);

      // Se houver override (broadcast/template inicial), enviar a mensagem
      if (input.definitionOverride?.steps?.length) {
        let step = input.definitionOverride.steps[0];

        // INTERPOLAÇÃO: Resolver variáveis {{var}} no passo antes de enviar
        const vars = input.initialVariables ?? {};
        const { interpolateDeep } = await import("./utils/variable-parser");
        step = interpolateDeep(step, vars);

        if (step.type === 'message' || step.type === 'send_message') {
          console.log(`[StartChatbotUseCase] Sending initial interpolated message (AI Agent override)`);

          const isTemplate = !!step.template;

          await this.messageSender.send({
            conversationId: input.conversationId,
            content: step.message,
            contentType: "text",
            messageType: isTemplate ? "template" : "outgoing",
            contentAttributes: {
              template: step.template,
              keepChatbot: true,
            } as any,
            attachments: step.attachments,
          });
        }
      }

      if (this.statusEmitter) {
        await this.statusEmitter.emitActive({
          conversationId: input.conversationId,
          sessionId: session.id,
          flowId: flow.id,
        });
      }
      return { session, messageIds: [] };
    }

    const definition = input.definitionOverride ?? flow.definition;
    const steps = Array.isArray(definition.steps) ? definition.steps : [];
    const startStepId = definition.startStepId ?? steps[0]?.id;
    if (!startStepId) {
      throw new Error("FLOW_EMPTY");
    }

    console.log(`[StartChatbotUseCase] Creating session for conversation ${input.conversationId} and flow ${flow.id}`);



    // Fluxo Legado (FLOW)
    const session = await this.sessionRepository.create({
      conversationId: input.conversationId,
      flowId: flow.id,
      status: "ACTIVE",
      currentStepId: startStepId,
      variables: input.initialVariables ?? {},
      lastInteractionAt: new Date(),
    });

    console.log(`[StartChatbotUseCase] Session created: ${session.id}. Starting FlowRunner from step ${startStepId}...`);
    const runner = new FlowRunner(this.pathEventRepository, this.messageSender, this.actionProvider);
    const result = await runner.runUntilInput({
      sessionId: session.id,
      conversationId: input.conversationId,
      flowId: flow.id,
      definition,
      stepId: startStepId,
      variables: input.initialVariables ?? {},
    });

    console.log(`[StartChatbotUseCase] FlowRunner finished with status ${result.status}, currentStepId: ${result.currentStepId}, messageIds: [${result.messageIds.join(", ")}]`);

    await this.sessionRepository.update(session.id, {
      status: result.status,
      currentStepId: result.currentStepId,
      variables: result.variables,
      lastInteractionAt: new Date(),
    });

    if (this.statusEmitter) {
      if (result.status === "ACTIVE") {
        await this.statusEmitter.emitActive({
          conversationId: input.conversationId,
          sessionId: session.id,
          flowId: flow.id,
        });
      } else {
        await this.statusEmitter.emitInactive({
          conversationId: input.conversationId,
          sessionId: session.id,
          flowId: flow.id,
        });
      }
    }

    return { session, messageIds: result.messageIds };
  }
}
