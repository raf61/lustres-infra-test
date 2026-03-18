import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ListTemplatesUseCase } from "@/chat/application/list-templates.usecase";
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
 * GET /api/chat/inboxes/[id]/templates
 * Retorna templates armazenados no banco (igual ao Chatwoot)
 */
export async function GET(
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

    const useCase = new ListTemplatesUseCase(inboxRepository);
    const result = await useCase.execute(id);
    
    return NextResponse.json({ 
      templates: result.templates,
      lastUpdatedAt: result.lastUpdatedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("[API] Error listing templates:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list templates" },
      { status: 500 }
    );
  }
}

