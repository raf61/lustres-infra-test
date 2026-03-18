import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { CreateConversationIfNotExistsUseCase } from '@/chat/application/create-conversation-if-not-exists.usecase';
import { CreateConversationUseCase } from '@/chat/application/create-conversation.usecase';
import { SendMessageUseCase } from '@/chat/application/send-message.usecase';
import { ListInboxesForUserUseCase } from '@/chat/application/list-inboxes-for-user.usecase';
import { PrismaContactRepository } from '@/chat/infra/repositories/prisma-contact-repository';
import { PrismaContactInboxRepository } from '@/chat/infra/repositories/prisma-contact-inbox-repository';
import { PrismaConversationRepository } from '@/chat/infra/repositories/prisma-conversation-repository';
import { PrismaInboxRepository } from '@/chat/infra/repositories/prisma-inbox-repository';
import { PrismaMessageRepository } from '@/chat/infra/repositories/prisma-message-repository';
import { getBullMQBroadcaster } from '@/chat/infra/events/bullmq-broadcaster';
import { RoleInboxAccessPolicy } from '@/chat/infra/policies/role-inbox-access-policy';

export const dynamic = 'force-dynamic';

// Instanciar dependências
const contactRepository = new PrismaContactRepository();
const contactInboxRepository = new PrismaContactInboxRepository();
const conversationRepository = new PrismaConversationRepository();
const inboxRepository = new PrismaInboxRepository();
const messageRepository = new PrismaMessageRepository();
const broadcaster = getBullMQBroadcaster();
const inboxAccessPolicy = new RoleInboxAccessPolicy();
const listInboxesForUserUseCase = new ListInboxesForUserUseCase(
  inboxRepository,
  inboxAccessPolicy
);

const sendMessageUseCase = new SendMessageUseCase(messageRepository, conversationRepository);
const createConversationUseCase = new CreateConversationUseCase(
  contactRepository,
  contactInboxRepository,
  conversationRepository,
  inboxRepository,
  sendMessageUseCase,
  broadcaster
);
const createConversationIfNotExistsUseCase = new CreateConversationIfNotExistsUseCase(
  contactRepository,
  contactInboxRepository,
  conversationRepository,
  inboxRepository,
  createConversationUseCase
);

/**
 * POST /api/chat/conversations/new
 * 
 * Cria uma nova conversa apenas se o número não existir na inbox.
 * Se já existir, retorna a conversa existente (sem criar).
 * 
 * Body:
 * {
 *   "inboxId": "xxx",
 *   "phoneNumber": "5511...",
 *   "contactName": "João" (opcional)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id as string;
    const body = await request.json().catch(() => null);

    if (!body?.inboxId || !body?.phoneNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: inboxId and phoneNumber' },
        { status: 400 }
      );
    }

    const allowed = await listInboxesForUserUseCase.execute({
      userId,
      role: (session.user as { role?: string | null })?.role ?? null,
    });
    const hasAccess = allowed.inboxes.some((inbox) => inbox.id === body.inboxId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Inbox não permitida.' }, { status: 403 });
    }

    const result = await createConversationIfNotExistsUseCase.execute({
      inboxId: body.inboxId,
      phoneNumber: body.phoneNumber,
      contactName: body.contactName,
      assigneeId: userId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[POST /api/chat/conversations/new] Error:', error);

    if (error.message?.includes('INBOX_NOT_FOUND')) {
      return NextResponse.json(
        { error: 'Inbox não encontrada', code: 'INBOX_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

