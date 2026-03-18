import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { CreateClientConversationUseCase } from '@/chat/application/create-client-conversation.usecase';
import { CreateConversationUseCase } from '@/chat/application/create-conversation.usecase';
import { ListInboxesForUserUseCase } from '@/chat/application/list-inboxes-for-user.usecase';
import { SendMessageUseCase } from '@/chat/application/send-message.usecase';
import { PrismaClientRepository } from '@/chat/infra/repositories/prisma-client-repository';
import { PrismaClientChatContactRepository } from '@/chat/infra/repositories/prisma-client-chat-contact-repository';
import { PrismaContactRepository } from '@/chat/infra/repositories/prisma-contact-repository';
import { PrismaContactInboxRepository } from '@/chat/infra/repositories/prisma-contact-inbox-repository';
import { PrismaConversationRepository } from '@/chat/infra/repositories/prisma-conversation-repository';
import { PrismaInboxRepository } from '@/chat/infra/repositories/prisma-inbox-repository';
import { PrismaMessageRepository } from '@/chat/infra/repositories/prisma-message-repository';
import { RoleInboxAccessPolicy } from '@/chat/infra/policies/role-inbox-access-policy';
import { getBullMQBroadcaster } from '@/chat/infra/events/bullmq-broadcaster';

export const dynamic = 'force-dynamic';

const contactRepository = new PrismaContactRepository();
const contactInboxRepository = new PrismaContactInboxRepository();
const conversationRepository = new PrismaConversationRepository();
const inboxRepository = new PrismaInboxRepository();
const messageRepository = new PrismaMessageRepository();
const clientRepository = new PrismaClientRepository();
const clientChatContactRepository = new PrismaClientChatContactRepository();
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

const inboxAccessPolicy = new RoleInboxAccessPolicy();
const listInboxesForUserUseCase = new ListInboxesForUserUseCase(
  inboxRepository,
  inboxAccessPolicy
);

const createClientConversationUseCase = new CreateClientConversationUseCase(
  createConversationUseCase,
  clientRepository,
  clientChatContactRepository
);

/**
 * POST /api/chat/clients/:id/conversation
 *
 * Body:
 * {
 *   "inboxId": "xxx",
 *   "phoneNumber": "5511...",
 *   "contactName": "João" (opcional)
 * }
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

    const resolvedParams = await params;
    const clientId = Number(resolvedParams.id);
    if (!Number.isFinite(clientId)) {
      return NextResponse.json({ error: 'Invalid client id' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.inboxId || !body?.phoneNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: inboxId and phoneNumber' },
        { status: 400 }
      );
    }

    const allowed = await listInboxesForUserUseCase.execute({
      userId: session.user.id as string,
      role: (session.user as { role?: string | null })?.role ?? null,
    });

    const hasAccess = allowed.inboxes.some((inbox) => inbox.id === body.inboxId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Inbox not allowed' }, { status: 403 });
    }

    const result = await createClientConversationUseCase.execute({
      clientId,
      inboxId: body.inboxId,
      phoneNumber: body.phoneNumber,
      contactName: body.contactName,
      assigneeId: session.user.id as string,
    });

    return NextResponse.json({
      conversationId: result.conversation.id,
      isNew: result.isNew,
    });
  } catch (error: any) {
    console.error('[POST /api/chat/clients/:id/conversation] Error:', error);

    if (error.message === 'CLIENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    if (error.message === 'INVALID_PHONE_NUMBER') {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }
    if (error.message?.includes('INBOX_NOT_FOUND')) {
      return NextResponse.json({ error: 'Inbox not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

