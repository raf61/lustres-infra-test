import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { GetConversationClientsUseCase } from '@/chat/application/get-conversation-clients.usecase';
import { PrismaConversationRepository } from '@/chat/infra/repositories/prisma-conversation-repository';
import { PrismaClientChatContactRepository } from '@/chat/infra/repositories/prisma-client-chat-contact-repository';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/conversations/:id/clients
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
    const conversationId = resolvedParams.id;

    const useCase = new GetConversationClientsUseCase(
      new PrismaConversationRepository(),
      new PrismaClientChatContactRepository()
    );

    const result = await useCase.execute({ conversationId });

    console.log('[GET /api/chat/conversations/:id/clients] Result:', { conversationId, clientIds: result.clientIds });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[GET /api/chat/conversations/:id/clients] Error:', error);
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

