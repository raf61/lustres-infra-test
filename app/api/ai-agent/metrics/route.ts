import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const broadcastIdsParam = searchParams.get('broadcastIds'); // multi-select
        const broadcastId = searchParams.get('broadcastId');        // single (legacy)

        const useFallback = searchParams.get('useFallback') === 'true';
        const states = searchParams.get('states')?.split(',').filter(Boolean) || [];
        const subset = searchParams.get('subset');

        if (broadcastIdsParam || broadcastId) {
            const ids = broadcastIdsParam
                ? broadcastIdsParam.split(',').filter(Boolean)
                : [broadcastId!];
            return handleDetailView(ids, useFallback, states, subset);
        }

        return handleListView();
    } catch (error: any) {
        console.error("[Metricas API] Erro:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function handleListView() {
    const broadcasts = await prisma.chatBroadcast.findMany({
        include: {
            inbox: { select: { name: true } },
            _count: { select: { recipients: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 200
    });

    const activeSessionsCount = await prisma.chatbotSession.count({
        where: {
            status: 'ACTIVE',
            flow: { engine: 'AI_AGENT' }
        }
    });

    const items = broadcasts.map((b: any) => ({
        id: b.id,
        flowName: b.name || `Broadcast: ${b.inbox.name}`,
        createdAt: b.createdAt,
        status: b.status,
        recipientCount: b._count.recipients,
    }));

    return NextResponse.json({ items, activeSessionsCount });
}

async function handleDetailView(broadcastIds: string[], useFallback: boolean = false, filteredStates: string[] = [], subset: string | null = null) {
    const broadcasts = await prisma.chatBroadcast.findMany({
        where: { id: { in: broadcastIds } },
        include: {
            inbox: { select: { name: true } },
            _count: { select: { recipients: true } }
        }
    });

    if (broadcasts.length === 0)
        return NextResponse.json({ error: "Broadcasts não encontrados" }, { status: 404 });

    const earliestDate = new Date(Math.min(...broadcasts.map(b => b.createdAt.getTime())));
    const broadcastInboxIds = [...new Set(broadcasts.map(b => b.inboxId))];

    // --- 1. Recipients & Client Data (for State Filtering) ---
    let recipientsRaw = await prisma.chatBroadcastRecipient.findMany({
        where: { broadcastId: { in: broadcastIds } },
        select: {
            contactId: true,
            clientId: true,
            createdAt: true,
            client: { select: { id: true, estado: true } }
        } as any
    });

    // Fallback for old records
    const contactIdsForFallback = recipientsRaw
        .filter(r => !(r as any).clientId && r.contactId)
        .map(r => r.contactId) as string[];

    const fallbackLinks = (useFallback && contactIdsForFallback.length > 0)
        ? await prisma.clientChatContact.findMany({
            where: { contactId: { in: contactIdsForFallback } },
            include: { client: { select: { id: true, estado: true } } }
        })
        : [];

    const fallbackMap = new Map<string, any>();
    fallbackLinks.forEach(l => fallbackMap.set(l.contactId, l.client));

    // Map everything to a unified structure
    let recipients = recipientsRaw.map(r => {
        const client = (r as any).client || fallbackMap.get(r.contactId!);
        return {
            contactId: r.contactId,
            clientId: client?.id,
            estado: client?.estado?.toUpperCase().trim() || "N/I",
            createdAt: r.createdAt
        };
    });

    // Apply State Filter if present
    if (filteredStates.length > 0) {
        recipients = recipients.filter(r => filteredStates.includes(r.estado));
    }

    const uniqueContactIds = [...new Set(recipients.map(r => r.contactId).filter(Boolean) as string[])];

    // --- 2. Conversations ---
    const conversationsRaw = await prisma.chatConversation.findMany({
        where: { contactId: { in: uniqueContactIds }, inboxId: { in: broadcastInboxIds } },
        select: { id: true, contactId: true }
    });
    let conversationIds = conversationsRaw.map(c => c.id);

    // --- 3. Sent Messages & Funnel Base ---
    const sentMessages = await prisma.chatMessage.findMany({
        where: {
            conversationId: { in: conversationIds },
            messageType: { in: ['outgoing', 'template'] },
            createdAt: { gte: earliestDate }
        },
        select: { status: true, conversationId: true, externalError: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
    });

    const firstMsgByConv = new Map<string, { status: string, error: string | null }>();
    for (const msg of sentMessages) {
        if (!firstMsgByConv.has(msg.conversationId)) {
            firstMsgByConv.set(msg.conversationId, { status: msg.status, error: msg.externalError });
        }
    }

    // Response Tracking (Engaged) - Get the timestamp of the FIRST response
    const firstResponses = await prisma.chatMessage.groupBy({
        by: ['conversationId'],
        _min: { createdAt: true },
        where: {
            conversationId: { in: conversationIds },
            messageType: 'incoming',
            createdAt: { gt: earliestDate }
        }
    });
    const firstResponseMap = new Map(firstResponses.map(r => [r.conversationId, r._min.createdAt]));
    const respondedConversationIds = new Set(firstResponseMap.keys());

    // AI Sessions
    const sessions = await prisma.chatbotSession.findMany({
        where: { conversationId: { in: conversationIds } },
        select: { id: true, conversationId: true }
    });
    const convToSessions = new Map<string, string[]>();
    sessions.forEach(s => {
        const list = convToSessions.get(s.conversationId) || [];
        list.push(s.id);
        convToSessions.set(s.conversationId, list);
    });

    // Follow-up Tracking
    const followupMetrics = await prisma.agentMetric.findMany({
        where: {
            sessionId: { in: sessions.map(s => s.id) },
            key: { in: ['FOLLOWUP_FIXED', 'FOLLOWUP_IA_JUDGE'] }
        },
        select: { conversationId: true, key: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
    });

    const followupConversationMap = new Map<string, { firstAt: Date, types: Set<string> }>();
    followupMetrics.forEach(m => {
        const existing = followupConversationMap.get(m.conversationId);
        if (!existing) {
            followupConversationMap.set(m.conversationId, { firstAt: m.createdAt, types: new Set([m.key]) });
        } else {
            existing.types.add(m.key);
            if (m.createdAt < existing.firstAt) existing.firstAt = m.createdAt;
        }
    });
    const followupConversationIds = new Set(followupConversationMap.keys());

    // --- 4. Apply Subset Filter (Drill down) ---
    if (subset) {
        if (subset === 'delivered') {
            conversationIds = conversationIds.filter(id => ['delivered', 'read'].includes(firstMsgByConv.get(id)?.status || ''));
        } else if (subset === 'read') {
            conversationIds = conversationIds.filter(id => firstMsgByConv.get(id)?.status === 'read');
        } else if (subset === 'responses') {
            conversationIds = [...respondedConversationIds];
        } else if (subset === 'followed_up') {
            conversationIds = [...followupConversationIds];
        }
    }

    // Re-filter sessions and metrics based on final subset
    const filteredSessionIds = sessions
        .filter(s => conversationIds.includes(s.conversationId))
        .map(s => s.id);

    // --- 5. Final Calculations based on Filtered Subset ---
    const toolMetrics = await prisma.agentMetric.groupBy({
        by: ['key', 'conversationId'],
        where: { sessionId: { in: filteredSessionIds } }
    });

    const toolCounts: Record<string, number> = {};
    toolMetrics.forEach(m => {
        toolCounts[m.key] = (toolCounts[m.key] || 0) + 1;
    });

    const aiActionConversations = new Set(
        toolMetrics
            .filter(m => ['TOOL_UPDATE_SYNDIC', 'TOOL_UPDATE_MAINTENANCE', 'HANDOFF', 'RESOLVED', 'RETURN_RESEARCH'].includes(m.key))
            .map(m => m.conversationId)
    );

    // Filter statuses and errors for the current subset
    const filteredStatuses = conversationIds.map(id => firstMsgByConv.get(id)?.status).filter(Boolean) as string[];
    const filteredErrors = conversationIds.map(id => firstMsgByConv.get(id)?.error).filter(Boolean) as string[];

    const errorGrouping: Record<string, number> = {};
    filteredErrors.forEach(err => {
        errorGrouping[err] = (errorGrouping[err] || 0) + 1;
    });

    // Recalculate Follow-up for the subset (Unique People)
    const convToContact = new Map(conversationsRaw.map(c => [c.id, c.contactId]));
    const filteredFollowupConvIds = [...followupConversationIds].filter(id => conversationIds.includes(id));

    const contactFollowups = new Map<string, string[]>(); // contactId -> conversationIds
    const contactInitialFollowups = new Map<string, string[]>();

    filteredFollowupConvIds.forEach(convId => {
        const contactId = convToContact.get(convId);
        if (contactId) {
            const list = contactFollowups.get(contactId) || [];
            list.push(convId);
            contactFollowups.set(contactId, list);

            const firstFup = followupConversationMap.get(convId)!.firstAt;
            const firstResp = firstResponseMap.get(convId);
            if (!firstResp || firstFup < firstResp) {
                const iList = contactInitialFollowups.get(contactId) || [];
                iList.push(convId);
                contactInitialFollowups.set(contactId, iList);
            }
        }
    });

    const totalFollowedUp = contactFollowups.size;
    const initialImpacted = contactInitialFollowups.size;

    let respondedAfterFollowup = 0;
    let initialRecovered = 0;

    const checkRecovery = async (convIds: string[]) => {
        const checks = await Promise.all(convIds.map(async (convId) => {
            const fup = followupConversationMap.get(convId)!;
            const response = await prisma.chatMessage.findFirst({
                where: { conversationId: convId, messageType: 'incoming', createdAt: { gt: fup.firstAt } },
                select: { id: true }
            });
            return !!response;
        }));
        return checks.some(Boolean);
    };

    if (totalFollowedUp > 0) {
        const recoveryResults = await Promise.all(Array.from(contactFollowups.values()).map(checkRecovery));
        respondedAfterFollowup = recoveryResults.filter(Boolean).length;
    }

    if (initialImpacted > 0) {
        const initialResults = await Promise.all(Array.from(contactInitialFollowups.values()).map(checkRecovery));
        initialRecovered = initialResults.filter(Boolean).length;
    }

    // --- 6. Business Metrics (Unique Clients & Conversions) ---
    // Get the set of contacts represented in our current conversation subset
    const activeContactIds = new Set(
        conversationsRaw
            .filter(c => conversationIds.includes(c.id))
            .map(c => c.contactId)
    );

    // Update clientActivity to only include clients from filtered recipients AND active contacts
    const clientActivity = recipients
        .filter(r => !!r.clientId && activeContactIds.has(r.contactId as string))
        .map(r => ({
            clientId: r.clientId as number,
            broadcastAt: r.createdAt
        }));

    const uniqueClientIds = Array.from(new Set(clientActivity.map(r => r.clientId)));

    // Fetch potential quotes and orders for these clients
    const allQuotes = await prisma.orcamento.findMany({
        where: {
            clienteId: { in: uniqueClientIds },
            createdAt: { gte: earliestDate },
            NOT: {
                pedido: { tipoEspecial: 'OS' }
            }
        },
        select: {
            id: true,
            clienteId: true,
            createdAt: true,
            cliente: { select: { id: true, razaoSocial: true } },
            vendedor: { select: { name: true } }
        }
    });

    const allOrdersRaw = await prisma.pedido.findMany({
        where: { clienteId: { in: uniqueClientIds }, createdAt: { gte: earliestDate } },
        select: {
            id: true,
            clienteId: true,
            createdAt: true,
            tipoEspecial: true,
            cliente: { select: { id: true, razaoSocial: true } },
            vendedor: { select: { name: true } }
        }
    });

    const allOrders = allOrdersRaw.filter(o => o.tipoEspecial !== 'OS');
    const allOS = allOrdersRaw.filter(o => o.tipoEspecial === 'OS');

    const quotesByClient = new Map<number, typeof allQuotes>();
    allQuotes.forEach(q => {
        const list = quotesByClient.get(q.clienteId) || [];
        list.push(q);
        quotesByClient.set(q.clienteId, list);
    });

    const ordersByClient = new Map<number, typeof allOrders>();
    allOrders.forEach(o => {
        const list = ordersByClient.get(o.clienteId) || [];
        list.push(o);
        ordersByClient.set(o.clienteId, list);
    });

    const osByClient = new Map<number, typeof allOS>();
    allOS.forEach(o => {
        const list = osByClient.get(o.clienteId) || [];
        list.push(o);
        osByClient.set(o.clienteId, list);
    });

    const influencedQuoteItems = new Map<number, any>();
    const influencedOrderItems = new Map<number, any>();
    const influencedOsItems = new Map<number, any>();

    clientActivity.forEach(r => {
        const windowEnd = new Date(r.broadcastAt.getTime() + 45 * 24 * 60 * 60 * 1000);

        const clientQuotes = quotesByClient.get(r.clientId) || [];
        clientQuotes.forEach(q => {
            if (q.createdAt >= r.broadcastAt && q.createdAt <= windowEnd) {
                influencedQuoteItems.set(q.id, {
                    id: q.id,
                    clientId: q.cliente.id,
                    clientName: q.cliente.razaoSocial,
                    vendedorName: q.vendedor?.name || 'N/I'
                });
            }
        });

        const clientOrders = ordersByClient.get(r.clientId) || [];
        clientOrders.forEach(o => {
            if (o.createdAt >= r.broadcastAt && o.createdAt <= windowEnd) {
                influencedOrderItems.set(o.id, {
                    id: o.id,
                    clientId: o.cliente.id,
                    clientName: o.cliente.razaoSocial,
                    vendedorName: o.vendedor?.name || 'N/I'
                });
            }
        });

        const clientOS = osByClient.get(r.clientId) || [];
        clientOS.forEach(o => {
            if (o.createdAt >= r.broadcastAt && o.createdAt <= windowEnd) {
                influencedOsItems.set(o.id, {
                    id: o.id,
                    clientId: o.cliente.id,
                    clientName: o.cliente.razaoSocial,
                    vendedorName: o.vendedor?.name || 'N/I'
                });
            }
        });
    });

    // --- 8. Location Metrics (by State) ---
    const clientsData = await prisma.client.findMany({
        where: { id: { in: uniqueClientIds } },
        select: { estado: true }
    });

    const stateCount: Record<string, number> = {};
    clientsData.forEach(c => {
        const uf = c.estado?.toUpperCase().trim() || "N/I";
        stateCount[uf] = (stateCount[uf] || 0) + 1;
    });

    const states = Object.entries(stateCount)
        .map(([uf, count]) => ({ uf, count, percentage: +(count / (uniqueClientIds.length || 1) * 100).toFixed(1) }))
        .sort((a, b) => b.count - a.count);

    // --- 9. Template Info ---
    let templateName = null;
    const firstValidRecipient = await prisma.chatBroadcastRecipient.findFirst({
        where: { broadcastId: { in: broadcastIds }, messageId: { not: null } },
        select: {
            message: {
                select: { contentAttributes: true }
            }
        }
    });

    const ca = firstValidRecipient?.message?.contentAttributes as any;
    if (ca?.template?.name) {
        templateName = ca.template.name;
    } else if (ca?.name) {
        templateName = ca.name;
    }

    // --- 10. Aggregate metrics ---
    const sent = recipients.length;
    const delivered = filteredStatuses.filter(s => ['delivered', 'read'].includes(s)).length;
    const read = filteredStatuses.filter(s => s === 'read').length;

    // Count responses only from the filtered set of conversations
    const responses = conversationIds.filter(id => respondedConversationIds.has(id)).length;

    const isMulti = broadcastIds.length > 1;
    const flowName = isMulti
        ? `${broadcastIds.length} disparos selecionados`
        : ((broadcasts[0] as any)?.name || `Broadcast: ${broadcasts[0]?.inbox?.name ?? ''}`);

    return NextResponse.json({
        broadcast: {
            id: broadcastIds.join(','),
            flowName,
            createdAt: earliestDate.toISOString(),
            status: isMulti ? 'MULTI' : broadcasts[0]?.status,
            count: broadcastIds.length,
            templateName
        },
        location: {
            states
        },
        funnel: {
            sent,
            delivered,
            read,
            responses,
            deliveryRate: sent > 0 ? +(delivered / sent * 100).toFixed(1) : 0,
            readRate: sent > 0 ? +(read / sent * 100).toFixed(1) : 0,
            responseRate: sent > 0 ? +(responses / sent * 100).toFixed(1) : 0,
        },
        aiActions: {
            updateSyndic: toolCounts['TOOL_UPDATE_SYNDIC'] || 0,
            updateMaintenance: toolCounts['TOOL_UPDATE_MAINTENANCE'] || 0,
            handoffs: toolCounts['HANDOFF'] || 0,
            resolved: toolCounts['RESOLVED'] || 0,
            returnResearch: toolCounts['RETURN_RESEARCH'] || 0,
            aiSuccessRate: responses > 0 ? +(aiActionConversations.size / responses * 100).toFixed(1) : 0,
        },
        followUp: {
            totalFollowedUp,
            followupFixed: toolCounts['FOLLOWUP_FIXED'] || 0,
            followupIaJudge: toolCounts['FOLLOWUP_IA_JUDGE'] || 0,
            respondedAfterFollowup,
            followupEfficacy: totalFollowedUp > 0 ? +(respondedAfterFollowup / totalFollowedUp * 100).toFixed(1) : 0,
            initialImpacted,
            initialRecovered,
            initialEfficacy: initialImpacted > 0 ? +(initialRecovered / initialImpacted * 100).toFixed(1) : 0,
        },
        analysis: {
            silentContacts: Math.max(0, delivered - responses),
            silentRate: delivered > 0 ? +(Math.max(0, delivered - responses) / delivered * 100).toFixed(1) : 0,
            readButNoResponse: Math.max(0, read - responses),
            readButNoResponseRate: read > 0 ? +(Math.max(0, read - responses) / read * 100).toFixed(1) : 0,
            errors: errorGrouping,
            uniqueClients: uniqueClientIds.length,
            conversionOS: Array.from(influencedOsItems.values()),
            conversionOrcamentos: Array.from(influencedQuoteItems.values()),
            conversionPedidos: Array.from(influencedOrderItems.values())
        },
        filters: {
            states: filteredStates,
            subset
        }
    });
}
