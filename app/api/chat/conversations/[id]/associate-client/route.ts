import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { AssociateClientToConversationUseCase } from '../../../../../../chat/application/associate-client-to-conversation.usecase';
import { GetConversationUseCase } from '../../../../../../chat/application/get-conversation.usecase';
import { PrismaConversationRepository } from '../../../../../../chat/infra/repositories/prisma-conversation-repository';
import { PrismaClientRepository } from '../../../../../../chat/infra/repositories/prisma-client-repository';
import { PrismaClientChatContactRepository } from '../../../../../../chat/infra/repositories/prisma-client-chat-contact-repository';

export const dynamic = 'force-dynamic';

const conversationRepository = new PrismaConversationRepository();
const clientRepository = new PrismaClientRepository();
const clientChatContactRepository = new PrismaClientChatContactRepository();

const associateClientUseCase = new AssociateClientToConversationUseCase(
  conversationRepository,
  clientRepository,
  clientChatContactRepository
);
const getConversationUseCase = new GetConversationUseCase(conversationRepository);

/**
 * POST /api/chat/conversations/:id/associate-client
 * Body: { cnpj: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const body = await request.json().catch(() => null);
    const cnpj = body?.cnpj as string | undefined;
    const clientId = body?.clientId as number | undefined;

    if (!cnpj && !clientId) {
      return NextResponse.json({ error: 'CNPJ ou ClientId obrigatório' }, { status: 400 });
    }

    await associateClientUseCase.execute({ conversationId, cnpj, clientId });

    const updatedConversation = await getConversationUseCase.execute({ conversationId });
    if (!updatedConversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json(updatedConversation);
  } catch (error: any) {
    console.error('[POST /api/chat/conversations/:id/associate-client] Error:', error);

    if (error.message === 'INVALID_CNPJ') {
      return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 });
    }
    if (error.message === 'CLIENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }
    if (error.message === 'CONVERSATION_NOT_FOUND') {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

