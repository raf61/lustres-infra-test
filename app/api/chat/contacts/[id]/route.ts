import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/chat/contacts/:id
 * 
 * Deleta um contato e todos os seus relacionamentos (clientes, conversas, mensagens)
 * devido ao onDelete: Cascade no Prisma.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permitir Vendedores também, para que possam limpar seus próprios contatos de teste
    const allowedRoles = ['MASTER', 'ADMINISTRADOR', 'SUPERVISOR', 'SAC', 'VENDEDOR'];
    const userRole = (session.user as any).role;
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id: contactId } = await params;

    if (!contactId) {
      return NextResponse.json({ error: 'Missing contactId' }, { status: 400 });
    }

    // Usar transação para garantir limpeza de FKs que não estão em cascata total no DB
    await prisma.$transaction(async (tx) => {
      // 1. Buscar IDs de todas as mensagens deste contato para limpar referências em BroadcastRecipient
      const relatedMessages = await tx.chatMessage.findMany({
        where: { conversation: { contactId: contactId } },
        select: { id: true }
      });
      const messageIds = relatedMessages.map(m => m.id);

      // 2. Desvincular de ChatBroadcastRecipient (evita erro P2003)
      await tx.chatBroadcastRecipient.updateMany({
        where: {
          OR: [
            { contactId: contactId },
            { messageId: { in: messageIds } }
          ]
        },
        data: {
          contactId: null,
          messageId: null,
          contactInboxId: null
        }
      });

      // 3. Deleta o contato principal (conversas e mensagens seguem por cascade do Prisma)
      await tx.chatContact.delete({
        where: { id: contactId },
      });
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[DELETE /api/chat/contacts/:id] Error:', error);
    return NextResponse.json({ error: 'Erro ao deletar contato' }, { status: 500 });
  }
}
