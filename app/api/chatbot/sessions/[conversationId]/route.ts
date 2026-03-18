import { NextResponse } from "next/server";
import { PrismaChatbotSessionRepository } from "@/chatbot/infra/repositories/prisma-chatbot-session-repository";
import { PrismaChatbotFlowRepository } from "@/chatbot/infra/repositories/prisma-chatbot-flow-repository";

type RouteParams = { params: Promise<{ conversationId: string }> };

const sessionRepository = new PrismaChatbotSessionRepository();
const flowRepository = new PrismaChatbotFlowRepository();

export async function GET(_request: Request, { params }: RouteParams) {
  const { conversationId } = await params;
  const session = await sessionRepository.findActiveByConversation(conversationId);
  if (!session) {
    return NextResponse.json({ data: null });
  }
  const flow = await flowRepository.findById(session.flowId);
  return NextResponse.json({
    data: {
      ...session,
      flow,
    },
  });
}
