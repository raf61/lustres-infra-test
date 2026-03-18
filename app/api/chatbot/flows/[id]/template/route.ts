import { NextRequest, NextResponse } from "next/server";
import { PrismaChatbotFlowRepository } from "@/chatbot/infra/repositories/prisma-chatbot-flow-repository";
import { ResolveOutboundTemplateUseCase } from "@/chatbot/application/resolve-outbound-template.usecase";

type RouteParams = { params: Promise<{ id: string }> };

const flowRepository = new PrismaChatbotFlowRepository();
const resolveTemplateUseCase = new ResolveOutboundTemplateUseCase(flowRepository);

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ data: null }, { status: 200 });
  }
  const template = await resolveTemplateUseCase.execute(id);
  return NextResponse.json({ data: template });
}
