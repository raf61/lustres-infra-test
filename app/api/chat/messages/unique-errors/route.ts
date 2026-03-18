import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Busca erros únicos que tenham o status failed
        const errors = await prisma.chatMessage.findMany({
            where: {
                status: 'failed',
                externalError: { not: null, contains: ':' } // Geralmente no formato "131049: Text"
            },
            select: {
                externalError: true
            },
            distinct: ['externalError']
        });

        // Mapeia para uma lista limpa e ordenada
        const uniqueErrors = errors
            .map(e => e.externalError!)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        return NextResponse.json({ errors: uniqueErrors });
    } catch (error: any) {
        console.error('[GET /api/chat/messages/unique-errors] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
