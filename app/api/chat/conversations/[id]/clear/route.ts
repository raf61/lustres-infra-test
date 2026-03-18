import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/conversations/:id/clear
 * 
 * Exclui todas as mensagens de uma conversa específica.
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

    // Verificar se a conversa existe
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Excluir todas as mensagens da conversa
    // O Prisma cuidará da exclusão em cascata dos anexos (conforme definido no schema)
    await prisma.chatMessage.deleteMany({
      where: { conversationId },
    });

    // Resetar lastActivityAt para a data atual (ou manter a original?)
    // O usuário quer "limpar a conversa", geralmente isso implica deixar "vazio".
    // Também devemos resetar lastSeen do agente talvez?
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: {
        waitingSince: null,
        // Mantemos lastActivityAt para não bagunçar a ordem drasticamente, ou atualizamos se preferir.
      },
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[POST /api/chat/conversations/:id/clear] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
