import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PrismaChatbotFlowRepository } from "@/chatbot/infra/repositories/prisma-chatbot-flow-repository";
import { PrismaChatbotSessionRepository } from "@/chatbot/infra/repositories/prisma-chatbot-session-repository";
import { AssignChatbotUseCase } from "@/chatbot/application/assign-chatbot.usecase";
import { BullMQChatbotStatusEmitter } from "@/chatbot/infra/realtime/bullmq-chatbot-status-emitter";

const flowRepository = new PrismaChatbotFlowRepository();
const sessionRepository = new PrismaChatbotSessionRepository();
const statusEmitter = new BullMQChatbotStatusEmitter();
const assignChatbotUseCase = new AssignChatbotUseCase(
  flowRepository,
  sessionRepository,
  statusEmitter
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.conversationId || !body.flowId) {
      return NextResponse.json({ error: "conversationId e flowId são obrigatórios" }, { status: 400 });
    }

    const conversationId = String(body.conversationId);
    const flowId = String(body.flowId);

    // Validações ficam na rota (boundary), não no usecase
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, status: true },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversa não encontrada", code: "CONVERSATION_NOT_FOUND" }, { status: 404 });
    }
    if (conversation.status !== "open") {
      return NextResponse.json(
        { error: "Não é permitido atribuir chatbot em conversa resolvida", code: "CONVERSATION_NOT_OPEN" },
        { status: 409 },
      );
    }

    const existingActive = await sessionRepository.findActiveByConversation(conversationId);
    if (existingActive) {
      return NextResponse.json(
        { error: "Já existe um chatbot ativo nesta conversa", code: "CHATBOT_ALREADY_ACTIVE" },
        { status: 409 },
      );
    }

    const session = await assignChatbotUseCase.execute({
      conversationId,
      flowId,
    });
    return NextResponse.json({ data: session });
  } catch (error) {
    console.error("[chatbot][sessions][assign]", error);
    if (error instanceof Error && error.message === "FLOW_NOT_FOUND") {
      return NextResponse.json({ error: "Fluxo não encontrado", code: "FLOW_NOT_FOUND" }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao atribuir chatbot" }, { status: 500 });
  }
}
