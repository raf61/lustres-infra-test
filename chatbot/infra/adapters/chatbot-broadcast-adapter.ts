import { prisma } from "../../../lib/prisma";
import type { IChatbotFlowRepository } from "../../domain/repositories/flow-repository";
import type { IChatbotSessionRepository } from "../../domain/repositories/session-repository";
import type { IChatbotPathEventRepository } from "../../domain/repositories/path-event-repository";
import type { IConversationRepository } from "../../../chat/domain/repositories/conversation-repository";
import type { ChatbotStep } from "../../domain/flow";
import { StartChatbotUseCase } from "../../application/start-chatbot.usecase";
import { applyTemplateOverride } from "../../application/utils/flow-utils";

type BroadcastContext = {
  conversationId: string;
  inboxId: string;
  broadcastId: string;
  contactName?: string | null;
  phoneNumber: string;
  contactId: string;
  clientId?: number | null;
  hasAssignee: boolean;
  assigneeId?: string | null;
};

export class ChatbotBroadcastAdapter {
  constructor(
    private readonly flowRepository: IChatbotFlowRepository,
    private readonly sessionRepository: IChatbotSessionRepository,
    private readonly pathEventRepository: IChatbotPathEventRepository,
    private readonly startChatbotUseCase: StartChatbotUseCase,
    private readonly conversationRepository: IConversationRepository
  ) { }

  async scheduleOutbound(params: {
    flowId: string | null;
    forceAssign: boolean;
    context: BroadcastContext;
    templateOverride?: ChatbotStep["template"];
    keepActiveSession?: boolean;
  }): Promise<{ handled: boolean; messageId?: string | null }> {
    console.log(`[ChatbotBroadcastAdapter] Starting scheduleOutbound for ${params.context.phoneNumber}`, { flowId: params.flowId });

    if (!params.flowId) {
      console.log(`[ChatbotBroadcastAdapter] Aborting: No flowId provided`);
      return { handled: false };
    }

    const flow = await this.flowRepository.findById(params.flowId);
    if (!flow) {
      console.log(`[ChatbotBroadcastAdapter] Aborting: Flow ${params.flowId} not found`);
      return { handled: false };
    }

    console.log(`[ChatbotBroadcastAdapter] Flow found: ${flow.name}, active: ${flow.active}, type: ${flow.type}`);
    if (!flow.active || flow.type !== "OUTBOUND") {
      console.log(`[ChatbotBroadcastAdapter] Aborting: Flow is inactive or not OUTBOUND`);
      return { handled: false };
    }

    if (!params.forceAssign && params.context.hasAssignee) {
      console.log(`[ChatbotBroadcastAdapter] Aborting: Conversation already has an assignee and forceAssign is false`);
      return { handled: false };
    }

    const existingSession = await this.sessionRepository.findActiveByConversation(
      params.context.conversationId
    );
    if (existingSession) {
      const existingFlow = await this.flowRepository.findById(existingSession.flowId);
      const isAI = existingFlow?.engine === "AI_AGENT";

      if (params.keepActiveSession && isAI) {
        console.log(`[ChatbotBroadcastAdapter] AI Session exists and keepActiveSession is true. Keeping.`);
        return { handled: false };
      }

      console.log(`[ChatbotBroadcastAdapter] Displacing existing session (isAI: ${isAI}, keepActive: ${params.keepActiveSession})`);
    }

    console.log(`[ChatbotBroadcastAdapter] No existing session. Fetching context for variables...`);

    // Fetch client and contact data to populate variables (same logic as ResolveTemplateVariablesUseCase)
    const [client, contact] = await Promise.all([
      params.context.clientId
        ? prisma.client.findUnique({ where: { id: params.context.clientId } })
        : null,
      params.context.contactId
        ? prisma.chatContact.findUnique({ where: { id: params.context.contactId } })
        : null,
    ]);

    const initialVariables: Record<string, any> = {
      // Basic flat variables
      contactName: params.context.contactName || contact?.name,
      nome_pessoa: params.context.contactName || contact?.name,
      nome_condominio: client?.razaoSocial,
      razao_social: client?.razaoSocial,
      endereco: client ? `${client.logradouro}, ${client.numero}${client.complemento ? ' - ' + client.complemento : ''}` : "endereço cadastrado",

      // Template specific variables (can be made dynamic later)
      valor_unitario_torre: "500",
      numero_parcelas: "5",
      valor_parcela: "100",

      phoneNumber: params.context.phoneNumber,
      clientId: params.context.clientId ?? null,
      contactId: params.context.contactId,
      conversationId: params.context.conversationId,
      inboxId: params.context.inboxId,
      broadcastId: params.context.broadcastId,

      // Mapped variables for deep resolution (e.g. {{client.nomeSindico}})
      "client.razaoSocial": client?.razaoSocial,
      "client.cnpj": client?.cnpj,
      "client.nomeSindico": client?.nomeSindico || params.context.contactName,
      "client.logradouro": client?.logradouro,
      "client.cidade": client?.cidade,
      "contact.name": params.context.contactName || contact?.name,
    };

    // Dynamic extraction from templateOverride
    if (params.templateOverride && params.templateOverride.components) {
      for (const component of params.templateOverride.components) {
        if (component.parameters && Array.isArray(component.parameters)) {
          for (const param of component.parameters) {
            if (param.parameter_name && param.text) {
              initialVariables[param.parameter_name] = param.text;
            }
          }
        }
      }
    }

    console.log(`[ChatbotBroadcastAdapter] Variables populated:`, {
      "client.nomeSindico": initialVariables["client.nomeSindico"],
      "client.razaoSocial": initialVariables["client.razaoSocial"],
      "valor_unitario_torre": initialVariables["valor_unitario_torre"]
    });

    let definitionOverride = undefined;

    if (flow.engine === "AI_AGENT" && params.templateOverride) {
      definitionOverride = {
        steps: [{
          id: "start-node",
          type: "send_message" as any,
          message: "",
          template: params.templateOverride
        }],
        startStepId: "start-node"
      } as any;
    } else {
      definitionOverride = params.templateOverride
        ? applyTemplateOverride(flow.definition, params.templateOverride)
        : undefined;
    }

    const result = await this.startChatbotUseCase.execute({
      conversationId: params.context.conversationId,
      flowId: flow.id,
      definitionOverride,
      initialVariables,
    });

    console.log(`[ChatbotBroadcastAdapter] StartChatbot result: messages [${result.messageIds.join(", ")}]`);

    // Assign conversation if assigneeId is provided
    if (params.context.assigneeId) {
      console.log(`[ChatbotBroadcastAdapter] Assigning conversation ${params.context.conversationId} to agent ${params.context.assigneeId}`);
      await this.conversationRepository.updateAssignee(
        params.context.conversationId,
        params.context.assigneeId
      );
    }

    return { handled: true, messageId: result.messageIds[0] ?? null };
  }
}
