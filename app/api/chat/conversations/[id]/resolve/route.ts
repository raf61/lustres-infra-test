import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { 
  ResolveConversationUseCase,
  ConversationNotFoundError,
} from '../../../../../../chat/application/resolve-conversation.usecase';
import { PrismaConversationRepository } from '../../../../../../chat/infra/repositories/prisma-conversation-repository';
import { getBullMQBroadcaster } from '../../../../../../chat/infra/events/bullmq-broadcaster';

export const dynamic = 'force-dynamic';

// Instanciar dependências (a Route conhece a infra, o UseCase não)
const conversationRepository = new PrismaConversationRepository();
const broadcaster = getBullMQBroadcaster();

const resolveConversationUseCase = new ResolveConversationUseCase(
  conversationRepository,
  broadcaster
);

/**
 * POST /api/chat/conversations/[id]/resolve
 * 
 * Resolve (fecha) uma conversa.
 * 
 * Path params:
 *   id: ID da conversa
 * 
 * Response:
 *   200: { conversation: {...}, wasAlreadyResolved: boolean }
 *   404: { error: "...", code: "CONVERSATION_NOT_FOUND" }
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await params;

    const result = await resolveConversationUseCase.execute({ conversationId });

    return NextResponse.json({
      conversation: {
        id: result.conversation.id,
        contactId: result.conversation.contactId,
        inboxId: result.conversation.inboxId,
        status: result.conversation.status,
        assigneeId: result.conversation.assigneeId,
        waitingSince: result.conversation.waitingSince,
        lastActivityAt: result.conversation.lastActivityAt,
      },
      wasAlreadyResolved: result.wasAlreadyResolved,
    });

  } catch (error: any) {
    console.error('[POST /api/chat/conversations/[id]/resolve] Error:', error);

    if (error instanceof ConversationNotFoundError) {
      return NextResponse.json(
        { error: error.message, code: 'CONVERSATION_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
