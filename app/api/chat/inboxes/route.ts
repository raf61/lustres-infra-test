import { NextResponse } from 'next/server';
import { auth } from '@/auth';

import { ListInboxesForUserUseCase } from '../../../../chat/application/list-inboxes-for-user.usecase';
import { CreateInboxUseCase } from '../../../../chat/application/create-inbox.usecase';
import { PrismaInboxRepository } from '../../../../chat/infra/repositories/prisma-inbox-repository';
import { RoleInboxAccessPolicy } from '../../../../chat/infra/policies/role-inbox-access-policy';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = new Set(['MASTER', 'ADMINISTRADOR']);

const inboxRepository = new PrismaInboxRepository();
const inboxAccessPolicy = new RoleInboxAccessPolicy();
const listInboxesForUserUseCase = new ListInboxesForUserUseCase(
  inboxRepository,
  inboxAccessPolicy
);

/**
 * GET /api/chat/inboxes
 * 
 * Lista todas as inboxes disponíveis.
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await listInboxesForUserUseCase.execute({
      userId: session.user.id as string,
      role: (session.user as { role?: string | null })?.role ?? null,
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[GET /api/chat/inboxes] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/chat/inboxes
 * Cria uma inbox (somente MASTER/ADMINISTRADOR)
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as { role?: string | null })?.role ?? null;
    if (!role || !ADMIN_ROLES.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const allowedRoles = Array.isArray(body?.allowedRoles)
      ? body.allowedRoles.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [];

    const useCase = new CreateInboxUseCase(inboxRepository);
    const result = await useCase.execute({
      name: String(body?.name || ''),
      provider: 'whatsapp_cloud',
      phoneNumberId: String(body?.phoneNumberId || ''),
      displayPhoneNumber: body?.displayPhoneNumber ? String(body.displayPhoneNumber) : null,
      allowedRoles,
      whatsappCloud: {
        wabaId: body?.whatsappCloud?.wabaId ? String(body.whatsappCloud.wabaId) : null,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/chat/inboxes] Error:', error);
    if (error?.message === 'INVALID_INPUT') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (error?.message === 'UNSUPPORTED_PROVIDER') {
      return NextResponse.json({ error: 'Provider not supported' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
