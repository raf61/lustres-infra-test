import type { SendMessageUseCase } from "../../application/send-message.usecase";

export type ChatbotBroadcastHandler = {
  validateOutboundFlow(flowId: string): Promise<void>;
  scheduleOutbound(params: {
    flowId: string | null;
    forceAssign: boolean;
    context: {
      conversationId: string;
      inboxId: string;
      broadcastId: string;
      contactName?: string | null;
      phoneNumber: string;
      contactId: string;
      clientId?: number | null;
      hasAssignee: boolean;
    };
  }): Promise<{ handled: boolean; messageId?: string | null }>;
};

export async function buildChatbotBroadcastHandler(
  sendMessageUseCase: SendMessageUseCase
): Promise<ChatbotBroadcastHandler> {
  const { PrismaChatbotFlowRepository } = await import(
    "../../../chatbot/infra/repositories/prisma-chatbot-flow-repository"
  );
  const { PrismaChatbotSessionRepository } = await import(
    "../../../chatbot/infra/repositories/prisma-chatbot-session-repository"
  );
  const { PrismaChatbotPathEventRepository } = await import(
    "../../../chatbot/infra/repositories/prisma-chatbot-path-event-repository"
  );
  const { StartChatbotUseCase } = await import(
    "../../../chatbot/application/start-chatbot.usecase"
  );
  const { SendMessageChatbotAdapter } = await import(
    "../../../chatbot/infra/senders/send-message-adapter"
  );
  const { BullMQChatbotStatusEmitter } = await import(
    "../../../chatbot/infra/realtime/bullmq-chatbot-status-emitter"
  );
  const { ChatbotBroadcastAdapter } = await import(
    "../../../chatbot/infra/adapters/chatbot-broadcast-adapter"
  );

  const { SystemChatbotActionProvider } = await import(
    "../../../chatbot/infra/actions/system-actions-adapter"
  );
  const { PrismaConversationRepository } = await import(
    "../../../chat/infra/repositories/prisma-conversation-repository"
  );
  const { prisma } = await import("../../../lib/prisma");

  const flowRepository = new PrismaChatbotFlowRepository();
  const sessionRepository = new PrismaChatbotSessionRepository();
  const pathEventRepository = new PrismaChatbotPathEventRepository();
  const messageSender = new SendMessageChatbotAdapter(sendMessageUseCase);
  const actionProvider = new SystemChatbotActionProvider(prisma);
  const conversationRepository = new PrismaConversationRepository();
  const statusEmitter = new BullMQChatbotStatusEmitter();

  const startChatbotUseCase = new StartChatbotUseCase(
    flowRepository,
    sessionRepository,
    pathEventRepository,
    messageSender,
    actionProvider,
    statusEmitter
  );
  const adapter = new ChatbotBroadcastAdapter(
    flowRepository,
    sessionRepository,
    pathEventRepository,
    startChatbotUseCase,
    conversationRepository
  );

  return {
    async validateOutboundFlow(flowId: string) {
      const flow = await flowRepository.findById(flowId);
      if (!flow || !flow.active || flow.type !== "OUTBOUND") {
        throw new Error("CHATBOT_FLOW_INVALID");
      }
    },
    scheduleOutbound: (params) =>
      adapter.scheduleOutbound({
        flowId: params.flowId,
        forceAssign: params.forceAssign,
        context: params.context,
      }),
  };
}

export async function validateChatbotOutboundFlow(flowId: string): Promise<void> {
  const { PrismaChatbotFlowRepository } = await import(
    "../../../chatbot/infra/repositories/prisma-chatbot-flow-repository"
  );
  const flowRepository = new PrismaChatbotFlowRepository();
  const flow = await flowRepository.findById(flowId);
  if (!flow || !flow.active || flow.type !== "OUTBOUND") {
    throw new Error("CHATBOT_FLOW_INVALID");
  }
}
