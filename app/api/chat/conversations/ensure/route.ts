import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CreateConversationUseCase } from '@/chat/application/create-conversation.usecase';
import { AssignConversationUseCase } from '@/chat/application/assign-conversation.usecase';
import { SendMessageUseCase } from '@/chat/application/send-message.usecase';
import { ListInboxesForUserUseCase } from '@/chat/application/list-inboxes-for-user.usecase';
import { PrismaContactRepository } from '@/chat/infra/repositories/prisma-contact-repository';
import { PrismaContactInboxRepository } from '@/chat/infra/repositories/prisma-contact-inbox-repository';
import { PrismaConversationRepository } from '@/chat/infra/repositories/prisma-conversation-repository';
import { PrismaInboxRepository } from '@/chat/infra/repositories/prisma-inbox-repository';
import { PrismaMessageRepository } from '@/chat/infra/repositories/prisma-message-repository';
import { getBullMQBroadcaster } from '@/chat/infra/events/bullmq-broadcaster';
import { RoleInboxAccessPolicy } from '@/chat/infra/policies/role-inbox-access-policy';

/**
 * Ensure a conversation exists for a given contact and inbox.
 * If the conversation doesn't exist, it will be created.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { inboxId, contactId } = body;

    if (!inboxId || !contactId) {
      return NextResponse.json(
        { error: 'inboxId e contactId são obrigatórios' },
        { status: 400 }
      );
    }

    const inboxRepository = new PrismaInboxRepository();
    const inboxAccessPolicy = new RoleInboxAccessPolicy();
    const listInboxesForUserUseCase = new ListInboxesForUserUseCase(
      inboxRepository,
      inboxAccessPolicy
    );
    const allowed = await listInboxesForUserUseCase.execute({
      userId: session.user.id as string,
      role: (session.user as { role?: string | null })?.role ?? null,
    });
    const hasAccess = allowed.inboxes.some((inbox) => inbox.id === inboxId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Inbox não permitida' }, { status: 403 });
    }

    // Verificar se o contato existe
    const contact = await prisma.chatContact.findUnique({
      where: { id: contactId },
      select: { id: true, waId: true, name: true },
    });

    if (!contact) {
      return NextResponse.json(
        { error: 'Contato não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se já existe ContactInbox
    const contactInbox = await prisma.chatContactInbox.findUnique({
      where: {
        contactId_inboxId: { contactId, inboxId },
      },
    });

    if (!contactInbox) {
      return NextResponse.json(
        { error: 'Contato não está vinculado a esta inbox' },
        { status: 400 }
      );
    }

    const contactRepository = new PrismaContactRepository();
    const contactInboxRepository = new PrismaContactInboxRepository();
    const conversationRepository = new PrismaConversationRepository();
    const messageRepository = new PrismaMessageRepository();
    const broadcaster = getBullMQBroadcaster();

    const sendMessageUseCase = new SendMessageUseCase(messageRepository, conversationRepository);
    const createConversationUseCase = new CreateConversationUseCase(
      contactRepository,
      contactInboxRepository,
      conversationRepository,
      inboxRepository,
      sendMessageUseCase,
      broadcaster
    );
    const assignConversationUseCase = new AssignConversationUseCase(conversationRepository, broadcaster);

    const result = await createConversationUseCase.execute({
      inboxId,
      phoneNumber: contact.waId,
      contactName: contact.name ?? undefined,
      assigneeId: session.user.id,
    });

    if (result.conversation.assigneeId !== session.user.id) {
      await assignConversationUseCase.execute({
        conversationId: result.conversation.id,
          assigneeId: session.user.id,
      });
    }

    return NextResponse.json({
      conversationId: result.conversation.id,
      isNew: result.isNew,
    });
  } catch (error) {
    console.error('[EnsureConversation] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno ao garantir conversa' },
      { status: 500 }
    );
  }
}

