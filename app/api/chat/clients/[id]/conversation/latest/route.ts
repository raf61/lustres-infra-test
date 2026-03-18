import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { FindLatestConversationForClientUseCase } from '@/chat/application/find-latest-conversation-for-client.usecase';
import { PrismaClientChatContactRepository } from '@/chat/infra/repositories/prisma-client-chat-contact-repository';
import { PrismaConversationRepository } from '@/chat/infra/repositories/prisma-conversation-repository';
import { PrismaInboxRepository } from '@/chat/infra/repositories/prisma-inbox-repository';
import { RoleInboxAccessPolicy } from '@/chat/infra/policies/role-inbox-access-policy';

export const dynamic = 'force-dynamic';

const buildFindLatestConversationForClientUseCase = () => {
  const clientChatContactRepository = new PrismaClientChatContactRepository();
  const conversationRepository = new PrismaConversationRepository();
  const inboxRepository = new PrismaInboxRepository();
  const inboxAccessPolicy = new RoleInboxAccessPolicy();

  return new FindLatestConversationForClientUseCase(
    clientChatContactRepository,
    conversationRepository,
    inboxRepository,
    inboxAccessPolicy
  );
};

/**
 * GET /api/chat/clients/:id/conversation/latest
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const clientId = Number(resolvedParams.id);
    if (!Number.isFinite(clientId)) {
      return NextResponse.json({ error: 'Invalid client id' }, { status: 400 });
    }

    const useCase = buildFindLatestConversationForClientUseCase();
    const result = await useCase.execute({
      clientId,
      userId: session.user.id as string,
      role: (session.user as { role?: string | null })?.role ?? null,
    });

    return NextResponse.json({ conversation: result });
  } catch (error: any) {
    console.error('[GET /api/chat/clients/:id/conversation/latest] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

