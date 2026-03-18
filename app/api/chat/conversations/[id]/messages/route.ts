import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { ListMessagesUseCase, ListMessagesInput } from '../../../../../../chat/application/list-messages.usecase';
import { PrismaMessageRepository } from '../../../../../../chat/infra/repositories/prisma-message-repository';

export const dynamic = 'force-dynamic';

// Instanciar dependências
const messageRepository = new PrismaMessageRepository();
const listMessagesUseCase = new ListMessagesUseCase(messageRepository);

/**
 * GET /api/chat/conversations/:id/messages
 * 
 * Lista mensagens de uma conversa com paginação por cursor.
 * 
 * Query params:
 * - before: ISO date string (cursor para carregar histórico - scroll up)
 * - after: ISO date string (cursor para carregar novas - polling)
 * - limit: number (default: 20, max: 100)
 * 
 * Exemplos:
 * - GET /messages                      → Últimas 20 mensagens
 * - GET /messages?before=2026-01-17... → 20 mensagens antes dessa data
 * - GET /messages?after=2026-01-17...  → Mensagens novas após essa data
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
    const { searchParams } = new URL(request.url);

    // Parsear query params
    const input: ListMessagesInput = {
      conversationId,
      before: searchParams.get('before') || undefined,
      after: searchParams.get('after') || undefined,
      limit: parseInt(searchParams.get('limit') || '20', 10),
    };

    const result = await listMessagesUseCase.execute(input);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[GET /api/chat/conversations/:id/messages] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

