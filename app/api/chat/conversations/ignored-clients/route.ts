import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/conversations/ignored-clients
 * Body: { clientIds: number[], sinceMs?: number }
 *
 * Returns:
 *  - ignoredClientIds: clients with outgoing messages but NO incoming in the period
 *  - activeClientIds:  clients with at least 1 incoming message in the period
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => null);

        const clientIds: number[] = Array.isArray(body?.clientIds)
            ? body.clientIds
                .map((id: any) => Number(id))
                .filter((id: number) => Number.isFinite(id) && id > 0)
            : [];

        // Accept milliseconds (new) or fallback to sinceMonths (legacy)
        let sinceMs: number;
        if (typeof body?.sinceMs === 'number' && body.sinceMs > 0) {
            sinceMs = body.sinceMs;
        } else {
            const months = typeof body?.sinceMonths === 'number' && body.sinceMonths > 0 ? body.sinceMonths : 3;
            sinceMs = months * 30 * 24 * 60 * 60 * 1000;
        }
        // Cap at 2 years to avoid runaway queries
        sinceMs = Math.min(sinceMs, 2 * 365 * 24 * 60 * 60 * 1000);

        const sinceDate = new Date(Date.now() - sinceMs);

        if (clientIds.length === 0) {
            return NextResponse.json({ ignoredClientIds: [], activeClientIds: [] });
        }

        // 1. Resolve contactIds for the given clientIds
        const clientContacts = await prisma.clientChatContact.findMany({
            where: { clientId: { in: clientIds } },
            select: { clientId: true, contactId: true },
        });

        if (clientContacts.length === 0) {
            return NextResponse.json({ ignoredClientIds: [], activeClientIds: [] });
        }

        const contactIds = clientContacts.map((cc) => cc.contactId);

        // 2. Resolve conversations for those contacts
        const conversations = await prisma.chatConversation.findMany({
            where: { contactId: { in: contactIds } },
            select: { id: true, contactId: true },
        });

        if (conversations.length === 0) {
            return NextResponse.json({ ignoredClientIds: [], activeClientIds: [] });
        }

        const conversationIds = conversations.map((c) => c.id);

        const convToContact = new Map<string, string>(
            conversations.map((c) => [c.id, c.contactId])
        );

        const contactToClients = new Map<string, number[]>();
        for (const cc of clientContacts) {
            const arr = contactToClients.get(cc.contactId) ?? [];
            arr.push(cc.clientId);
            contactToClients.set(cc.contactId, arr);
        }

        // 3. Aggregate message counts per conversation+type within the time window
        const counts = await prisma.chatMessage.groupBy({
            by: ['conversationId', 'messageType'],
            where: {
                conversationId: { in: conversationIds },
                messageType: { in: ['incoming', 'outgoing', 'template'] },
                createdAt: { gte: sinceDate },
            },
            _count: { id: true },
        });

        type ConvFlags = { hasOutgoing: boolean; hasIncoming: boolean };
        const convFlags = new Map<string, ConvFlags>();
        for (const row of counts) {
            const entry = convFlags.get(row.conversationId) ?? {
                hasOutgoing: false,
                hasIncoming: false,
            };
            if (row.messageType === 'incoming') entry.hasIncoming = true;
            if (row.messageType === 'outgoing' || row.messageType === 'template')
                entry.hasOutgoing = true;
            convFlags.set(row.conversationId, entry);
        }

        // 4. Roll up flags to client level
        const clientHasIncoming = new Map<number, boolean>();
        const clientHasOutgoing = new Map<number, boolean>();

        for (const [convId, flags] of convFlags.entries()) {
            const contactId = convToContact.get(convId);
            if (!contactId) continue;
            const clientsOfContact = contactToClients.get(contactId) ?? [];
            for (const clientId of clientsOfContact) {
                if (flags.hasOutgoing) clientHasOutgoing.set(clientId, true);
                if (flags.hasIncoming) clientHasIncoming.set(clientId, true);
            }
        }

        // "ignored" = we sent at least 1 message AND client never replied
        const ignoredClientIds = clientIds.filter(
            (id) => clientHasOutgoing.get(id) === true && !clientHasIncoming.get(id)
        );

        // "active" = client sent at least 1 message in the window
        const activeClientIds = clientIds.filter(
            (id) => clientHasIncoming.get(id) === true
        );

        return NextResponse.json({ ignoredClientIds, activeClientIds });
    } catch (error: any) {
        console.error('[POST /api/chat/conversations/ignored-clients] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
