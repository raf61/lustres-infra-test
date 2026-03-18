import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { 
  UpdateLastSeenUseCase,
  ConversationNotFoundError,
} from '../../../../../../chat/application/update-last-seen.usecase';
import { PrismaConversationRepository } from '../../../../../../chat/infra/repositories/prisma-conversation-repository';
import { getBullMQBroadcaster } from '../../../../../../chat/infra/events/bullmq-broadcaster';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/conversations/:id/update_last_seen
 * 
 * Marca que o agente viu a conversa (atualiza agentLastSeenAt).
 * Igual ao Chatwoot: update_last_seen
 * 
 * O unreadCount é calculado dinamicamente:
 *   messages.where(messageType: 'incoming', createdAt > agentLastSeenAt).count
 * 
 * Faz broadcast para atualizar outros clients (ex: dashboard vendedor)
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

    // Instanciar dentro do handler para evitar problemas de HMR
    const conversationRepository = new PrismaConversationRepository();
    const broadcaster = getBullMQBroadcaster();
    const updateLastSeenUseCase = new UpdateLastSeenUseCase(conversationRepository, broadcaster);

    const result = await updateLastSeenUseCase.execute({ conversationId });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[POST /api/chat/conversations/:id/update_last_seen] Error:', error);

    if (error instanceof ConversationNotFoundError) {
      return NextResponse.json(
        { error: error.message, code: 'CONVERSATION_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
