import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BroadcastDispatchUseCase } from "@/chat/application/broadcast-dispatch.usecase";
import { ListInboxesForUserUseCase } from "@/chat/application/list-inboxes-for-user.usecase";
import { PrismaInboxRepository } from "@/chat/infra/repositories/prisma-inbox-repository";
import { RoleInboxAccessPolicy } from "@/chat/infra/policies/role-inbox-access-policy";

type ContactPayload = {
  phoneNumber: string;
  contactName?: string | null;
  clientId?: number | null;
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.inboxId || !Array.isArray(body?.contacts)) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const inboxRepository = new PrismaInboxRepository();
    const inboxAccessPolicy = new RoleInboxAccessPolicy();
    const listInboxesForUserUseCase = new ListInboxesForUserUseCase(inboxRepository, inboxAccessPolicy);
    const allowed = await listInboxesForUserUseCase.execute({
      userId: session.user.id as string,
      role: (session.user as { role?: string | null })?.role ?? null,
    });

    const hasAccess = allowed.inboxes.some((inbox) => inbox.id === body.inboxId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Inbox não permitida." }, { status: 403 });
    }

    const contacts: ContactPayload[] = body.contacts;

    const useCase = new BroadcastDispatchUseCase(prisma);
    const result = await useCase.execute({
      inboxId: body.inboxId,
      contacts,
      name: body.name ?? null,
      createdById: session.user.id as string,
      chatbotFlowId: body.chatbotFlowId ?? null,
      forceChatbotAssign: Boolean(body.forceChatbotAssign),
      keepChatbot: Boolean(body.keepChatbot),
      message: {
        contentType: "template",
        messageType: "template",
        contentAttributes: body?.message?.contentAttributes?.template
          ? { template: body.message.contentAttributes.template }
          : undefined,
        attachments: body.message?.attachments,
        assigneeId: session.user.id as string,
      },
    });

    return NextResponse.json({ data: result }, { status: 202 });
  } catch (error) {
    console.error("[broadcast][POST]", error);
    const message = error instanceof Error ? error.message : "Erro ao disparar mensagens.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
