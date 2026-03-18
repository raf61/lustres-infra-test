import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { CreateConversationUseCase, CreateConversationInput } from '../../../../chat/application/create-conversation.usecase';
import { ListInboxesForUserUseCase } from '../../../../chat/application/list-inboxes-for-user.usecase';
import { ListConversationsUseCase, ListConversationsInput } from '../../../../chat/application/list-conversations.usecase';
import { enforceAssigneeFilterForRole } from '../../../../chat/domain/policies/chat-role-policy';
import { SendMessageUseCase } from '../../../../chat/application/send-message.usecase';
import { PrismaContactRepository } from '../../../../chat/infra/repositories/prisma-contact-repository';
import { PrismaContactInboxRepository } from '../../../../chat/infra/repositories/prisma-contact-inbox-repository';
import { PrismaConversationRepository } from '../../../../chat/infra/repositories/prisma-conversation-repository';
import { PrismaInboxRepository } from '../../../../chat/infra/repositories/prisma-inbox-repository';
import { PrismaMessageRepository } from '../../../../chat/infra/repositories/prisma-message-repository';
import { getBullMQBroadcaster } from '../../../../chat/infra/events/bullmq-broadcaster';
import { RoleInboxAccessPolicy } from '../../../../chat/infra/policies/role-inbox-access-policy';

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

// Instanciar SendMessageUseCase
const sendMessageUseCase = new SendMessageUseCase(messageRepository, conversationRepository);

// Instanciar CreateConversationUseCase
const createConversationUseCase = new CreateConversationUseCase(
  contactRepository,
  contactInboxRepository,
  conversationRepository,
  inboxRepository,
  sendMessageUseCase,
  broadcaster
);

// Instanciar ListConversationsUseCase
const listConversationsUseCase = new ListConversationsUseCase(conversationRepository);

/**
 * GET /api/chat/conversations
 * 
 * Lista conversas com filtros e contadores.
 * 
 * Query params:
 * - assignee: 'me' | 'unassigned' | 'all' (default: 'all')
 * - status: 'open' | 'resolved' | 'pending' | 'all' (default: 'open')
 * - waiting: 'true' (filtra só as que estão esperando resposta)
 * - inbox: string (ID da inbox)
 * - page: number (default: 1)
 * - limit: number (default: 25)
 * - sort: 'last_activity' | 'waiting_since' | 'created_at' (default: 'last_activity')
 * - order: 'asc' | 'desc' (default: 'desc')
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id as string;
    const role = (session.user as { role?: string | null })?.role ?? null;

    const { searchParams } = new URL(request.url);
    const requestedAssigneeId = searchParams.get('assigneeId') || undefined;
    const canFilterByAssigneeId = role === 'MASTER' || role === 'ADMINISTRADOR';
    if (requestedAssigneeId && !canFilterByAssigneeId) {
      return NextResponse.json({ error: 'Assignee filter not allowed.' }, { status: 403 });
    }

    const allowed = await listInboxesForUserUseCase.execute({
      userId,
      role,
    });
    const allowedInboxIds = allowed.inboxes.map((inbox) => inbox.id);

    // Parsear query params
    const requestedAssignee =
      (searchParams.get('assignee') as 'me' | 'unassigned' | 'all') || 'all';

    const input: ListConversationsInput = {
      userId,
      assignee: requestedAssignee,
      status: (searchParams.get('status') as 'open' | 'resolved' | 'pending' | 'all') || 'open',
      waiting: searchParams.get('waiting') === 'true',
      inboxId: searchParams.get('inbox') || undefined,
      inboxIds: allowedInboxIds,
      assigneeId:
        requestedAssigneeId && canFilterByAssigneeId && requestedAssignee === 'all'
          ? requestedAssigneeId
          : undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '25', 10),
      sortBy: (searchParams.get('sort') as 'last_activity' | 'waiting_since' | 'created_at') || 'last_activity',
      sortOrder: (searchParams.get('order') as 'asc' | 'desc') || 'desc',
    };
    input.assignee = enforceAssigneeFilterForRole({ role, requested: input.assignee });

    if (input.inboxId && !allowedInboxIds.includes(input.inboxId)) {
      return NextResponse.json({ error: 'Inbox não permitida.' }, { status: 403 });
    }

    if (allowedInboxIds.length === 0) {
      return NextResponse.json({
        conversations: [],
        counts: { mine: 0, unassigned: 0, all: 0 },
        pagination: {
          page: input.page ?? 1,
          limit: input.limit ?? 25,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Validação básica
    if (input.limit && input.limit > 100) {
      input.limit = 100; // Máximo 100 por página
    }

    const result = await listConversationsUseCase.execute(input);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[GET /api/chat/conversations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/chat/conversations
 * 
 * Cria uma conversa proativa (x1) com opção de enviar mensagem junto.
 * É aqui que serão os disparos
 * Body:
 * {
 *   "inboxId": "xxx",           // Obrigatório
 *   "phoneNumber": "5511...",   // Obrigatório
 *   "contactName": "João",      // Opcional
 *   "assigneeId": "xxx",        // Opcional (ID do agente)
 *   "message": {                // Opcional (se quiser enviar msg junto)
 *     "content": "Olá!",
 *     "messageType": "template", // Se não tiver janela de 24h
 *     "contentAttributes": {
 *       "template": { ... }
 *     }
 *   }
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

    if (!body || !body.inboxId || !body.phoneNumber) {
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

    const input: CreateConversationInput = {
      inboxId: body.inboxId,
      phoneNumber: body.phoneNumber,
      contactName: body.contactName,
      assigneeId: body.assigneeId || userId, // Se não especificar, atribui ao próprio usuário
      message: body.message,
    };

    const result = await createConversationUseCase.execute(input);

    return NextResponse.json({
      conversation: {
        id: result.conversation.id,
        contactId: result.conversation.contactId,
        inboxId: result.conversation.inboxId,
        status: result.conversation.status,
        assigneeId: result.conversation.assigneeId,
      },
      isNew: result.isNew,
      message: result.messageSent ? {
        id: result.messageSent.message.id,
        queued: result.messageSent.queued,
      } : undefined,
    }, { status: result.isNew ? 201 : 200 });

  } catch (error: any) {
    console.error('[POST /api/chat/conversations] Error:', error);

    // Erro de inbox não encontrada
    if (error.message?.includes('INBOX_NOT_FOUND')) {
      return NextResponse.json(
        { error: 'Inbox não encontrada', code: 'INBOX_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Erro de janela de 24h (vem do SendMessageUseCase)
    if (error.message?.includes('OUT_OF_24H_WINDOW')) {
      return NextResponse.json(
        { 
          error: 'Fora da janela de 24h. Use messageType: "template" com um template aprovado.',
          code: 'OUT_OF_24H_WINDOW' 
        },
        { status: 403 }
      );
    }

    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

