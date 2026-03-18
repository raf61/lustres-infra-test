import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { UpdateInboxAllowedRolesUseCase } from '@/chat/application/update-inbox-allowed-roles.usecase';
import { PrismaInboxRepository } from '@/chat/infra/repositories/prisma-inbox-repository';

const ADMIN_ROLES = new Set(['MASTER', 'ADMINISTRADOR']);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as { role?: string | null })?.role ?? null;
    if (!role || !ADMIN_ROLES.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const allowedRolesInput = Array.isArray(body?.allowedRoles) ? body.allowedRoles : [];
    const allowedRoles = allowedRolesInput
      .map((roleValue: unknown) => String(roleValue).trim())
      .filter((roleValue: string) => roleValue.length > 0);

    const useCase = new UpdateInboxAllowedRolesUseCase(new PrismaInboxRepository());
    const result = await useCase.execute({
      inboxId: id,
      allowedRoles,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[PUT /api/chat/inboxes/:id/allowed-roles] Error:', error);
    if (error?.message === 'INBOX_NOT_FOUND') {
      return NextResponse.json({ error: 'Inbox not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

