import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { SyncTemplatesUseCase } from "@/chat/application/sync-templates.usecase";
import { ListInboxesForUserUseCase } from "@/chat/application/list-inboxes-for-user.usecase";
import { PrismaInboxRepository } from "@/chat/infra/repositories/prisma-inbox-repository";
import { RoleInboxAccessPolicy } from "@/chat/infra/policies/role-inbox-access-policy";

const inboxRepository = new PrismaInboxRepository();
const inboxAccessPolicy = new RoleInboxAccessPolicy();
const listInboxesForUserUseCase = new ListInboxesForUserUseCase(
  inboxRepository,
  inboxAccessPolicy
);

/**
 * POST /api/chat/inboxes/[id]/templates/sync
 * Sincroniza templates do WhatsApp Business Manager (igual ao Chatwoot)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const allowed = await listInboxesForUserUseCase.execute({
      userId: session.user.id as string,
      role: (session.user as { role?: string | null })?.role ?? null,
    });
    const hasAccess = allowed.inboxes.some((inbox) => inbox.id === id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Inbox não permitida." }, { status: 403 });
    }

    console.log('id', id);
    const useCase = new SyncTemplatesUseCase(inboxRepository);
    const result = await useCase.execute(id);
    console.log('result', result);
    return NextResponse.json({
      success: result.success,
      templatesCount: result.templatesCount,
      updatedAt: result.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[API] Error syncing templates:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync templates" },
      { status: 500 }
    );
  }
}

