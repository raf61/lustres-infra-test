import { NextRequest, NextResponse } from "next/server";
import { PrismaChatbotSessionRepository } from "@/chatbot/infra/repositories/prisma-chatbot-session-repository";
import { UnassignChatbotUseCase } from "@/chatbot/application/unassign-chatbot.usecase";
import { BullMQChatbotStatusEmitter } from "@/chatbot/infra/realtime/bullmq-chatbot-status-emitter";

const sessionRepository = new PrismaChatbotSessionRepository();
const statusEmitter = new BullMQChatbotStatusEmitter();
const unassignChatbotUseCase = new UnassignChatbotUseCase(sessionRepository, statusEmitter);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.conversationId) {
      return NextResponse.json({ error: "conversationId é obrigatório" }, { status: 400 });
    }
    const session = await unassignChatbotUseCase.execute({
      conversationId: body.conversationId,
    });
    return NextResponse.json({ data: session });
  } catch (error) {
    console.error("[chatbot][sessions][unassign]", error);
    return NextResponse.json({ error: "Erro ao desatribuir chatbot" }, { status: 500 });
  }
}
