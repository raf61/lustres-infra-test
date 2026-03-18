import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { ListClientConversationSummariesUseCase } from '@/chat/application/list-client-conversation-summaries.usecase';
import { PrismaClientChatContactRepository } from '@/chat/infra/repositories/prisma-client-chat-contact-repository';
import { PrismaConversationRepository } from '@/chat/infra/repositories/prisma-conversation-repository';
import { PrismaInboxRepository } from '@/chat/infra/repositories/prisma-inbox-repository';
import { RoleInboxAccessPolicy } from '@/chat/infra/policies/role-inbox-access-policy';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/conversations/by-clients
 * Body: { clientIds: number[] }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const clientIds: number[] = Array.isArray(body?.clientIds)
      ? body.clientIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
      : [];

    if (clientIds.length === 0) {
      return NextResponse.json({ summaries: [] });
    }

    const useCase = new ListClientConversationSummariesUseCase(
      new PrismaClientChatContactRepository(),
      new PrismaConversationRepository(),
      new PrismaInboxRepository(),
      new RoleInboxAccessPolicy()
    );

    const result = await useCase.execute({
      clientIds,
      userId: session.user.id as string,
      role: (session.user as { role?: string | null })?.role ?? null,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[POST /api/chat/conversations/by-clients] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

