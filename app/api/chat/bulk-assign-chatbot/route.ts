import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BulkAssignChatbotUseCase } from "@/chat/application/broadcast/bulk-assign-chatbot.usecase";
import { ListInboxesForUserUseCase } from "@/chat/application/list-inboxes-for-user.usecase";
import { PrismaInboxRepository } from "@/chat/infra/repositories/prisma-inbox-repository";
import { RoleInboxAccessPolicy } from "@/chat/infra/policies/role-inbox-access-policy";

type ContactPayload = {
    phoneNumber: string;
    contactName?: string | null;
    clientId?: number | null;
};

/**
 * POST /api/chat/bulk-assign-chatbot
 *
 * Assigns a chatbot flow to multiple contacts in bulk.
 * This does NOT send any messages — it only creates/replaces chatbot sessions.
 *
 * Body:
 *   inboxId: string
 *   chatbotFlowId: string
 *   contacts: Array<{ phoneNumber: string; contactName?: string; clientId?: number }>
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => null);

        if (!body?.inboxId || !body?.chatbotFlowId || !Array.isArray(body?.contacts)) {
            return NextResponse.json(
                { error: "Payload inválido. Campos obrigatórios: inboxId, chatbotFlowId, contacts." },
                { status: 400 }
            );
        }

        if (body.contacts.length === 0) {
            return NextResponse.json({ error: "Nenhum contato informado." }, { status: 400 });
        }

        // Hard limit to prevent abuse
        const MAX_CONTACTS = 500;
        if (body.contacts.length > MAX_CONTACTS) {
            return NextResponse.json(
                { error: `Máximo de ${MAX_CONTACTS} contatos por vez.` },
                { status: 400 }
            );
        }

        // Validate inbox access
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

        // Flow validation (OUTBOUND + AI_AGENT) is enforced inside BulkAssignChatbotUseCase

        const contacts: ContactPayload[] = body.contacts;

        const useCase = new BulkAssignChatbotUseCase(prisma);
        const result = await useCase.execute({
            inboxId: body.inboxId,
            chatbotFlowId: body.chatbotFlowId,
            assigneeId: session.user.id as string,
            contacts,
        });

        console.log("[bulk-assign-chatbot] completed", result);

        return NextResponse.json({ data: result }, { status: 200 });
    } catch (error) {
        console.error("[bulk-assign-chatbot][POST]", error);
        const message = error instanceof Error ? error.message : "Erro ao atribuir chatbot em massa.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
