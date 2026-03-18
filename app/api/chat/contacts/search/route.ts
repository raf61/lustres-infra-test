import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { SearchContactsUseCase } from '@/chat/application/search-contacts.usecase';
import { buildSearchAssigneeScopeForRole } from '@/chat/domain/policies/chat-role-policy';
import { ListInboxesForUserUseCase } from '@/chat/application/list-inboxes-for-user.usecase';
import { PrismaInboxRepository } from '@/chat/infra/repositories/prisma-inbox-repository';
import { RoleInboxAccessPolicy } from '@/chat/infra/policies/role-inbox-access-policy';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') || '';
    const inboxId = searchParams.get('inboxId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '30', 10);
    const role = (session.user as { role?: string | null })?.role ?? null;

    if (!inboxId) {
      return NextResponse.json({ error: 'inboxId é obrigatório' }, { status: 400 });
    }

    const inboxRepository = new PrismaInboxRepository();
    const inboxAccessPolicy = new RoleInboxAccessPolicy();
    const listInboxesForUserUseCase = new ListInboxesForUserUseCase(
      inboxRepository,
      inboxAccessPolicy
    );
    const allowed = await listInboxesForUserUseCase.execute({
      userId: session.user.id as string,
      role,
    });
    const hasAccess = allowed.inboxes.some((inbox) => inbox.id === inboxId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Inbox não permitida.' }, { status: 403 });
    }

    // Limitar pageSize para evitar abusos
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(1, pageSize), 50);

    const useCase = new SearchContactsUseCase(prisma);
    const result = await useCase.execute({
      query,
      inboxId,
      page: safePage,
      pageSize: safePageSize,
      assigneeScope: buildSearchAssigneeScopeForRole({
        role,
        userId: session.user.id as string,
      }),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ContactSearch] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno ao buscar contatos' },
      { status: 500 }
    );
  }
}

