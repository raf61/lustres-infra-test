import { NextRequest, NextResponse } from "next/server";
import { PrismaChatbotFlowRepository } from "@/chatbot/infra/repositories/prisma-chatbot-flow-repository";

const flowRepository = new PrismaChatbotFlowRepository();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const active = searchParams.get("active");
  const type = searchParams.get("type");
  const engine = searchParams.get("engine");
  let flows = await flowRepository.list({
    active: active === null ? undefined : active === "true",
    type: type ?? undefined,
  });
  if (engine) {
    flows = flows.filter((f) => f.engine === engine);
  }
  return NextResponse.json({ data: flows });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawDefinition = body.definition ?? { steps: [] };
    const normalizedDefinition =
      rawDefinition?.definition && rawDefinition?.definition?.steps
        ? rawDefinition.definition
        : rawDefinition;
    const flow = await flowRepository.create({
      name: body.name,
      engine: body.engine || "FLOW",
      type: body.type || "INBOUND",
      active: body.active ?? true,
      inboxId: body.inboxId ?? null,
      definition: normalizedDefinition,
      aiConfig: body.aiConfig ?? {},
    });
    return NextResponse.json({ data: flow }, { status: 201 });
  } catch (error) {
    console.error("[chatbot][flows][POST]", error);
    return NextResponse.json({ error: "Erro ao criar fluxo" }, { status: 500 });
  }
}
