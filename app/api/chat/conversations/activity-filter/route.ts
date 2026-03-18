import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { FOLLOW_UP_LIMIT } from '@/ai_agent/core/follow-up/cadence';

export const dynamic = 'force-dynamic';

/**
 * Filter logic:
 * We want to find sets of clients that MEET a certain condition (e.g., has active chatbot).
 * If the filter is "COM" (With), we keep only those in the set.
 * If the filter is "SEM" (Without), we remove anyone in that set from the candidates.
 */
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

        const chatbotWith: boolean | undefined = body?.chatbotActive === true ? true : (body?.chatbotActive === false ? false : undefined);
        const followUpWith: boolean | undefined = body?.followUpPending === true ? true : (body?.followUpPending === false ? false : undefined);
        const fupStep: number | undefined = typeof body?.followUpStep === 'number' ? body.followUpStep : undefined;
        const fupStepExclude: boolean = Boolean(body?.followUpStepExclude);

        if (clientIds.length === 0) {
            return NextResponse.json({ matchingClientIds: [] });
        }

        if (chatbotWith === undefined && followUpWith === undefined && fupStep === undefined) {
            return NextResponse.json({ matchingClientIds: clientIds });
        }

        // 1. Map everything: Client -> Contacts -> Conversations
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
        const conversations = await prisma.chatConversation.findMany({
            where: { contactId: { in: contactIds } },
            select: { id: true, contactId: true }
        });

        const convToContact = new Map<string, string>(conversations.map(c => [c.id, c.contactId]));
        const conversationIds = conversations.map(c => c.id);

        const getClientsFromConv = (convId: string): number[] => {
            const cid = convToContact.get(convId);
            return cid ? (contactToClients.get(cid) ?? []) : [];
        };

        // Start with all as candidates
        let candidates = new Set<number>(clientIds);

        // --- FILTER 1: CHATBOT ---
        if (chatbotWith !== undefined) {
            // Find all CLIENTS that HAVE an active chatbot session
            const activeSessions = await prisma.chatbotSession.findMany({
                where: { conversationId: { in: conversationIds }, status: 'ACTIVE' },
                select: { conversationId: true }
            });

            const clientsMeetingCondition = new Set<number>();
            for (const s of activeSessions) {
                getClientsFromConv(s.conversationId).forEach(id => clientsMeetingCondition.add(id));
            }

            if (chatbotWith === true) {
                // Keep only those who HAVE it
                candidates = new Set([...candidates].filter(id => clientsMeetingCondition.has(id)));
            } else {
                // Remove those who HAVE it (Keep those who DONT)
                for (const id of clientsMeetingCondition) {
                    candidates.delete(id);
                }
            }
        }

        // --- FILTER 2: FOLLOW-UP ---
        if (followUpWith !== undefined || fupStep !== undefined) {
            const followUpControls = await prisma.chatFollowUpControl.findMany({
                where: { conversationId: { in: conversationIds } },
                select: { conversationId: true, count: true }
            });

            const clientsWithPendingFup = new Set<number>();
            const clientsWithSpecificStep = new Set<number>();

            for (const ctrl of followUpControls) {
                if (ctrl.count < FOLLOW_UP_LIMIT) {
                    getClientsFromConv(ctrl.conversationId).forEach(id => clientsWithPendingFup.add(id));
                }
                if (fupStep !== undefined && ctrl.count === fupStep) {
                    getClientsFromConv(ctrl.conversationId).forEach(id => clientsWithSpecificStep.add(id));
                }
            }

            // Apply Pending Filter
            if (followUpWith === true) {
                candidates = new Set([...candidates].filter(id => clientsWithPendingFup.has(id)));
            } else if (followUpWith === false) {
                for (const id of clientsWithPendingFup) {
                    candidates.delete(id);
                }
            }

            // Apply Step Filter
            if (fupStep !== undefined) {
                if (fupStepExclude === false) { // "COM" Passo N
                    candidates = new Set([...candidates].filter(id => clientsWithSpecificStep.has(id)));
                } else { // "SEM" Passo N
                    for (const id of clientsWithSpecificStep) {
                        candidates.delete(id);
                    }
                }
            }
        }

        return NextResponse.json({ matchingClientIds: [...candidates] });
    } catch (error: any) {
        console.error('[POST /api/chat/conversations/activity-filter] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
