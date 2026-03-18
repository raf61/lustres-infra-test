import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const records = await prisma.chatInboxBotDefault.findMany({
    include: {
      inbox: { select: { id: true, name: true } },
      flow: { select: { id: true, name: true, type: true, active: true } },
    },
  });
  return NextResponse.json({ data: records });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.inboxId || !body.flowId) {
      return NextResponse.json({ error: "inboxId e flowId são obrigatórios" }, { status: 400 });
    }
    const flow = await prisma.chatbotFlow.findUnique({ where: { id: body.flowId } });
    if (!flow || !flow.active || flow.type !== "INBOUND") {
      return NextResponse.json({ error: "Fluxo inbound inválido" }, { status: 400 });
    }
    const record = await prisma.chatInboxBotDefault.upsert({
      where: { inboxId: body.inboxId },
      update: {
        flowId: body.flowId,
        active: body.active ?? true,
      },
      create: {
        inboxId: body.inboxId,
        flowId: body.flowId,
        active: body.active ?? true,
      },
    });
    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("[chatbot][inbox-defaults][POST]", error);
    return NextResponse.json({ error: "Erro ao salvar default" }, { status: 500 });
  }
}
