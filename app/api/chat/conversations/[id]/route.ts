import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { GetConversationUseCase } from '../../../../../chat/application/get-conversation.usecase';
import { PrismaConversationRepository } from '../../../../../chat/infra/repositories/prisma-conversation-repository';

export const dynamic = 'force-dynamic';

// Instanciar dependências
const conversationRepository = new PrismaConversationRepository();
const getConversationUseCase = new GetConversationUseCase(conversationRepository);

/**
 * GET /api/chat/conversations/:id
 * 
 * Retorna detalhes de uma conversa específica.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await params;

    const result = await getConversationUseCase.execute({ conversationId });

    if (!result) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[GET /api/chat/conversations/:id] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

