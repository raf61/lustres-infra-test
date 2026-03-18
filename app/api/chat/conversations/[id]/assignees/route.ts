import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ListInboxesForUserUseCase } from "@/chat/application/list-inboxes-for-user.usecase"
import { PrismaInboxRepository } from "@/chat/infra/repositories/prisma-inbox-repository"
import { RoleInboxAccessPolicy } from "@/chat/infra/policies/role-inbox-access-policy"

export const dynamic = "force-dynamic"

const inboxRepository = new PrismaInboxRepository()
const inboxAccessPolicy = new RoleInboxAccessPolicy()
const listInboxesForUserUseCase = new ListInboxesForUserUseCase(inboxRepository, inboxAccessPolicy)

const normalizeRole = (role?: string | null) => (role || "").toString().trim().toUpperCase()

function allowsAllRoles(allowedRoles: string[]): boolean {
  const normalized = allowedRoles.map(normalizeRole)
  return normalized.includes("ALL") || normalized.includes("*")
}

/**
 * GET /api/chat/conversations/:id/assignees
 *
 * Lista usuários ativos elegíveis para serem assignee desta conversa,
 * respeitando allowedRoles da inbox.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id as string
    const requesterRole = (session.user as { role?: string | null })?.role ?? null

    const { id: conversationId } = await params

    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, inboxId: true },
    })
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const allowed = await listInboxesForUserUseCase.execute({ userId, role: requesterRole })
    const allowedInboxIds = allowed.inboxes.map((inbox) => inbox.id)
    if (!allowedInboxIds.includes(conversation.inboxId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const inbox = await prisma.chatInbox.findUnique({
      where: { id: conversation.inboxId },
      select: { settings: true },
    })

    const settings = (inbox?.settings || {}) as { allowedRoles?: string[] }
    const allowedRolesRaw = Array.isArray(settings.allowedRoles) ? settings.allowedRoles : []
    const allowedRoles = allowedRolesRaw.map(normalizeRole).filter((r) => r.length > 0)

    const shouldFilterByRole = allowedRoles.length > 0 && !allowsAllRoles(allowedRoles)

    const users = await prisma.user.findMany({
      where: {
        active: true,
        ...(shouldFilterByRole ? { role: { in: allowedRoles as any } } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    })

    return NextResponse.json({ users })
  } catch (error: unknown) {
    console.error("[GET /api/chat/conversations/:id/assignees] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

