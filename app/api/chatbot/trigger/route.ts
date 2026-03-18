import { NextRequest, NextResponse } from "next/server";
import { PrismaChatbotFlowRepository } from "@/chatbot/infra/repositories/prisma-chatbot-flow-repository";
import { PrismaChatbotSessionRepository } from "@/chatbot/infra/repositories/prisma-chatbot-session-repository";
import { PrismaChatbotPathEventRepository } from "@/chatbot/infra/repositories/prisma-chatbot-path-event-repository";
import { StartChatbotUseCase } from "@/chatbot/application/start-chatbot.usecase";
import { SendMessageUseCase } from "@/chat/application/send-message.usecase";
import { PrismaMessageRepository } from "@/chat/infra/repositories/prisma-message-repository";
import { PrismaConversationRepository } from "@/chat/infra/repositories/prisma-conversation-repository";
import { SendMessageChatbotAdapter } from "@/chatbot/infra/senders/send-message-adapter";
import { BullMQChatbotStatusEmitter } from "@/chatbot/infra/realtime/bullmq-chatbot-status-emitter";

import { SystemChatbotActionProvider } from "@/chatbot/infra/actions/system-actions-adapter";
import { prisma } from "@/lib/prisma";

const flowRepository = new PrismaChatbotFlowRepository();
const sessionRepository = new PrismaChatbotSessionRepository();
const pathEventRepository = new PrismaChatbotPathEventRepository();
const messageRepository = new PrismaMessageRepository();
const conversationRepository = new PrismaConversationRepository();
const sendMessageUseCase = new SendMessageUseCase(messageRepository, conversationRepository);
const messageSender = new SendMessageChatbotAdapter(sendMessageUseCase);
const actionProvider = new SystemChatbotActionProvider(prisma);
const statusEmitter = new BullMQChatbotStatusEmitter();
const startChatbotUseCase = new StartChatbotUseCase(
  flowRepository,
  sessionRepository,
  pathEventRepository,
  messageSender,
  actionProvider,
  statusEmitter
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.conversationId || !body.flowId) {
      return NextResponse.json({ error: "conversationId e flowId são obrigatórios" }, { status: 400 });
    }
    const result = await startChatbotUseCase.execute({
      conversationId: body.conversationId,
      flowId: body.flowId,
    });
    return NextResponse.json({ data: result.session, messageIds: result.messageIds });
  } catch (error: any) {
    if (error instanceof Error && error.message?.includes("OUT_OF_24H_WINDOW")) {
      return NextResponse.json({ error: "FORA_DA_JANELA_24H" }, { status: 409 });
    }
    console.error("[chatbot][trigger]", error);
    return NextResponse.json({ error: "Erro ao disparar fluxo" }, { status: 500 });
  }
}
