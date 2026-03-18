import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PrismaChatbotFlowRepository } from "@/chatbot/infra/repositories/prisma-chatbot-flow-repository";

const flowRepository = new PrismaChatbotFlowRepository();

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const flow = await flowRepository.findById(id);
  if (!flow) {
    return NextResponse.json({ error: "Fluxo não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ data: flow });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const flow = await flowRepository.update(id, {
      name: body.name,
      type: body.type,
      active: body.active,
      inboxId: body.inboxId,
      definition: body.definition,
    });
    return NextResponse.json({ data: flow });
  } catch (error) {
    console.error("[chatbot][flows][PATCH]", error);
    return NextResponse.json({ error: "Erro ao atualizar fluxo" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string | null })?.role ?? null;
    if (!session?.user?.id || (role !== "MASTER" && role !== "ADMINISTRADOR")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    await flowRepository.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[chatbot][flows][DELETE]", error);
    return NextResponse.json({ error: "Erro ao remover fluxo" }, { status: 500 });
  }
}
