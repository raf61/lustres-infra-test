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

        if (clientIds.length === 0) {
            return NextResponse.json({ matchingClientIds: [] });
        }

        const inboxId = body?.inboxId;
        const inboxMode = body?.inboxMode || 'com';
        const templateName = body?.templateName;
        const templateMode = body?.templateMode || 'com';

        if (!inboxId && !templateName) {
            return NextResponse.json({ matchingClientIds: clientIds });
        }

        // 1. Map everything: Client -> Contacts
        const clientChatContacts = await prisma.clientChatContact.findMany({
            where: { clientId: { in: clientIds } },
            select: { clientId: true, contactId: true }
        });

        const contactToClients = new Map<string, number[]>();
        for (const cc of clientChatContacts) {
            const arr = contactToClients.get(cc.contactId) ?? [];
            arr.push(cc.clientId);
            contactToClients.set(cc.contactId, arr);
        }

        const contactIds = Array.from(contactToClients.keys());

        // Helper to get clients from a list of contact IDs
        const getClientsFromContacts = (cIds: string[]): number[] => {
            const result = new Set<number>();
            for (const cid of cIds) {
                const cids = contactToClients.get(cid) ?? [];
                cids.forEach(id => result.add(id));
            }
            return Array.from(result);
        };

        let candidates = new Set<number>(clientIds);

        // --- FILTER 1: INBOX ---
        if (inboxId) {
            const conversationsInInbox = await prisma.chatConversation.findMany({
                where: {
                    contactId: { in: contactIds },
                    inboxId: inboxId
                },
                select: { contactId: true }
            });

            const uniqueContactsInInbox = Array.from(new Set(conversationsInInbox.map(c => c.contactId)));
            const clientsMeetingInbox = getClientsFromContacts(uniqueContactsInInbox);

            if (inboxMode === 'com') {
                const meetingSet = new Set(clientsMeetingInbox);
                candidates = new Set([...candidates].filter(id => meetingSet.has(id)));
            } else {
                clientsMeetingInbox.forEach(id => candidates.delete(id));
            }
        }

        // --- FILTER 2: TEMPLATE ---
        if (templateName) {
            // Find messages with this template for the relevant conversations
            // We need the conversation IDs for the contacts we have
            const relevantConversations = await prisma.chatConversation.findMany({
                where: { contactId: { in: contactIds } },
                select: { id: true, contactId: true }
            });
            const conversationIds = relevantConversations.map(c => c.id);
            const convToContact = new Map(relevantConversations.map(c => [c.id, c.contactId]));

            // Query messages by template name
            const messagesWithTemplate = await prisma.chatMessage.findMany({
                where: {
                    conversationId: { in: conversationIds },
                    contentAttributes: {
                        path: ['template', 'name'],
                        equals: templateName
                    }
                },
                select: { conversationId: true }
            });

            const matchingContactIds = Array.from(new Set(
                messagesWithTemplate.map(m => convToContact.get(m.conversationId)).filter(Boolean) as string[]
            ));

            const clientsMeetingTemplate = getClientsFromContacts(matchingContactIds);

            if (templateMode === 'com') {
                const meetingSet = new Set(clientsMeetingTemplate);
                candidates = new Set([...candidates].filter(id => meetingSet.has(id)));
            } else {
                clientsMeetingTemplate.forEach(id => candidates.delete(id));
            }
        }

        return NextResponse.json({ matchingClientIds: [...candidates] });

    } catch (error: any) {
        console.error('[POST /api/chat/conversations/inbox-template-filter] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
