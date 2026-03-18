import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        const clientIds: number[] = Array.isArray(body?.clientIds)
            ? body.clientIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
            : [];
        const errorValue: string | null = body?.errorValue || null;
        const mode: 'com' | 'sem' = body?.mode === 'sem' ? 'sem' : 'com';

        if (clientIds.length === 0) {
            return NextResponse.json({ matchingClientIds: [] });
        }

        /**
         * 1. Buscar os contatos vinculados a estes clientes
         */
        const clientContacts = await prisma.clientChatContact.findMany({
            where: { clientId: { in: clientIds } },
            select: { clientId: true, contactId: true }
        });

        const contactToClients = new Map<string, number[]>();
        for (const cc of clientContacts) {
            const arr = contactToClients.get(cc.contactId) ?? [];
            arr.push(cc.clientId);
            contactToClients.set(cc.contactId, arr);
        }

        const contactIds = Array.from(contactToClients.keys());

        /**
         * 2. Buscar as conversas e o status das suas mensagens.
         * Buscamos apenas as conversas que já têm mensagens.
         */
        const conversations = await prisma.chatConversation.findMany({
            where: {
                contactId: { in: contactIds },
                messages: { some: {} } // Pelo menos uma mensagem
            },
            select: {
                id: true,
                contactId: true,
                messages: {
                    select: {
                        messageType: true,
                        status: true,
                        externalError: true
                    }
                }
            }
        });

        /**
         * 3. Aplicar os critérios na conversa:
         * - Todas as mensagens enviadas por nós (messageType != incoming)
         * - TODAS as mensagens deram 'failed'
         * - Se selecionado um erro, ao menos uma delas tem o erro selecionado
         */
        const matchingClientIdsCond = new Set<number>();
        for (const conv of conversations) {
            const msgs = conv.messages;
            if (msgs.length === 0) continue;

            const allOutgoing = msgs.every(m => m.messageType !== 'incoming');
            const allFailed = msgs.every(m => m.status === 'failed');

            let isMatch = allOutgoing && allFailed;

            // Se houver um erro selecionado, o match exige que esse erro esteja presente
            if (isMatch && errorValue) {
                isMatch = msgs.some(m => m.externalError === errorValue);
            }

            if (isMatch) {
                const clientsForThisContact = contactToClients.get(conv.contactId) ?? [];
                clientsForThisContact.forEach(id => matchingClientIdsCond.add(id));
            }
        }

        // Se o modo for "com", retorna apenas os que deram match
        if (mode === 'com') {
            return NextResponse.json({ matchingClientIds: Array.from(matchingClientIdsCond) });
        }

        // Se o modo for "sem", retorna todos os fornecidos MINUS os que deram match
        const resultIds = clientIds.filter(id => !matchingClientIdsCond.has(id));
        return NextResponse.json({ matchingClientIds: resultIds });

    } catch (error: any) {
        console.error('[POST /api/chat/conversations/error-filter] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
