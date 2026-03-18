import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { 
  AssignConversationUseCase,
  ConversationNotFoundError,
  AssigneeNotFoundError,
} from '../../../../../../chat/application/assign-conversation.usecase';
import { PrismaConversationRepository } from '../../../../../../chat/infra/repositories/prisma-conversation-repository';
import { getBullMQBroadcaster } from '../../../../../../chat/infra/events/bullmq-broadcaster';

export const dynamic = 'force-dynamic';

const conversationRepository = new PrismaConversationRepository();
const broadcaster = getBullMQBroadcaster();
const assignConversationUseCase = new AssignConversationUseCase(conversationRepository, broadcaster);

/**
 * PATCH /api/chat/conversations/:id/assign
 * 
 * Atribui uma conversa a um agente.
 * 
 * Body: { "assigneeId": "userId" | null }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const body = await request.json().catch(() => ({}));

    const result = await assignConversationUseCase.execute({
      conversationId,
      assigneeId: body.assigneeId ?? null,
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[PATCH /api/chat/conversations/:id/assign] Error:', error);

    if (error instanceof ConversationNotFoundError) {
      return NextResponse.json(
        { error: error.message, code: 'CONVERSATION_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (error instanceof AssigneeNotFoundError) {
      return NextResponse.json(
        { error: error.message, code: 'ASSIGNEE_NOT_FOUND' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
