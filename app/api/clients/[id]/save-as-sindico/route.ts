import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const clientId = parseInt(id);
        const body = await request.json();
        const { name, phone } = body;

        if (!name || !phone) {
            return NextResponse.json({ error: 'Nome e telefone são obrigatórios' }, { status: 400 });
        }

        // Buscar cliente atual
        const client = await prisma.client.findUnique({
            where: { id: clientId }
        });

        if (!client) {
            return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
        }

        // Preparar observação com histórico
        const oldSindicoInfo = `[sindico antigo: nome: ${client.nomeSindico || 'N/A'}, telefone: ${client.telefoneSindico || 'N/A'}]`;
        const newObservacao = `${client.observacao || ""}|${oldSindicoInfo}`


        // Atualizar
        await prisma.client.update({
            where: { id: clientId },
            data: {
                nomeSindico: name,
                telefoneSindico: phone,
                observacao: newObservacao
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[POST /api/clients/:id/save-as-sindico] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
