import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { GetStatusCountsUseCase } from '@/chat/application/get-status-counts.usecase';
import { enforceAssigneeFilterForRole } from '@/chat/domain/policies/chat-role-policy';
import { PrismaConversationRepository } from '@/chat/infra/repositories/prisma-conversation-repository';
import { PrismaInboxRepository } from '@/chat/infra/repositories/prisma-inbox-repository';
import { ListInboxesForUserUseCase } from '@/chat/application/list-inboxes-for-user.usecase';
import { RoleInboxAccessPolicy } from '@/chat/infra/policies/role-inbox-access-policy';

export const dynamic = 'force-dynamic';

// Instanciar dependências
const conversationRepository = new PrismaConversationRepository();
const getStatusCountsUseCase = new GetStatusCountsUseCase(conversationRepository);
const inboxRepository = new PrismaInboxRepository();
const inboxAccessPolicy = new RoleInboxAccessPolicy();
const listInboxesForUserUseCase = new ListInboxesForUserUseCase(
  inboxRepository,
  inboxAccessPolicy
);

/**
 * GET /api/chat/conversations/counts
 * 
 * Retorna contagens de conversas por status para uma inbox específica.
 * 
 * Query params:
 * - inbox: string (ID da inbox - obrigatório)
 * - assignee: 'me' | 'all' (default: 'me')
 * 
 * Response:
 * {
 *   open: number,     // status='open' (inclui waiting)
 *   waiting: number,  // status='open' e waitingSince IS NOT NULL
 *   resolved: number  // status='resolved'
 * }
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
    const inboxId = searchParams.get('inbox');
    const requestedAssigneeId = searchParams.get('assigneeId') || undefined;
    const canFilterByAssigneeId = role === 'MASTER' || role === 'ADMINISTRADOR';
    if (requestedAssigneeId && !canFilterByAssigneeId) {
      return NextResponse.json({ error: 'Assignee filter not allowed.' }, { status: 403 });
    }
    const assigneeFilter = enforceAssigneeFilterForRole({
      role,
      requested: (searchParams.get('assignee') as 'me' | 'all') || 'me',
    });
    const assignee = assigneeFilter === 'unassigned' ? 'all' : assigneeFilter;

    if (!inboxId) {
      return NextResponse.json(
        { error: 'Missing required parameter: inbox' },
        { status: 400 }
      );
    }

    const allowed = await listInboxesForUserUseCase.execute({
      userId,
      role,
    });
    const hasAccess = allowed.inboxes.some((inbox) => inbox.id === inboxId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Inbox não permitida.' }, { status: 403 });
    }

    const result = await getStatusCountsUseCase.execute({
      inboxId,
      userId,
      assignee,
      assigneeId:
        assignee === 'all' && requestedAssigneeId && canFilterByAssigneeId
          ? requestedAssigneeId
          : undefined,
    });

    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error('[GET /api/chat/conversations/counts] Error:', error);
    
    if (error instanceof Error && error.message === 'INBOX_REQUIRED') {
      return NextResponse.json(
        { error: 'Missing required parameter: inbox' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
