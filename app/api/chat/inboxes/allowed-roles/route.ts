import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ListInboxesAllowedRolesUseCase } from '@/chat/application/list-inboxes-allowed-roles.usecase';
import { PrismaInboxRepository } from '@/chat/infra/repositories/prisma-inbox-repository';

const ADMIN_ROLES = new Set(['MASTER', 'ADMINISTRADOR']);

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as { role?: string | null })?.role ?? null;
    if (!role || !ADMIN_ROLES.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const useCase = new ListInboxesAllowedRolesUseCase(new PrismaInboxRepository());
    const result = await useCase.execute();

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[GET /api/chat/inboxes/allowed-roles] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

