import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { SendMessageUseCase, SendMessageInput } from '../../../../chat/application/send-message.usecase';
import { PrismaMessageRepository } from '../../../../chat/infra/repositories/prisma-message-repository';
import { PrismaConversationRepository } from '../../../../chat/infra/repositories/prisma-conversation-repository';

export const dynamic = 'force-dynamic';

const messageRepository = new PrismaMessageRepository();
const conversationRepository = new PrismaConversationRepository();
const sendMessageUseCase = new SendMessageUseCase(messageRepository, conversationRepository);

/**
 * POST /api/chat/messages
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id as string;

    const body = await request.json().catch(() => null);

    if (!body || !body.conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    }

    const input: SendMessageInput = {
      conversationId: body.conversationId,
      assigneeId: userId, // Usando o ID do usuário autenticado
      content: body.content,
      contentType: body.contentType,
      messageType: body.messageType,
      attachments: body.attachments,
      // Mesclar atributos do corpo ou de contentAttributes (padrão Chatwoot)
      contentAttributes: {
        inReplyTo: body.inReplyTo || body.contentAttributes?.inReplyTo,
        template: body.template || body.contentAttributes?.template,
        items: body.items || body.contentAttributes?.items,
      },
    };

    const result = await sendMessageUseCase.execute(input);

    return NextResponse.json(result, { status: 202 });
  } catch (error: any) {
    console.error('[POST /api/chat/messages] Error:', error);
    
    if (error.message?.includes('OUT_OF_24H_WINDOW')) {
      return NextResponse.json({ error: error.message, code: 'OUT_OF_24H_WINDOW' }, { status: 403 });
    }

    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
