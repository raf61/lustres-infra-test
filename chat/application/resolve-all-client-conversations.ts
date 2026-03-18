import { prisma } from "../../lib/prisma";
import { getBullMQBroadcaster } from "../infra/events/bullmq-broadcaster";
import { getChatbotEventsQueue } from "../../chatbot/infra/queue/chatbot-events.queue";
import { ResolveConversationUseCase } from "./resolve-conversation.usecase";
import { PrismaConversationRepository } from "../infra/repositories/prisma-conversation-repository";

/**
 * AÇÃO AUXILIAR (Bypass Clean Arch):
 * Localiza e resolve todas as conversas abertas vinculadas a um cliente.
 */
export async function resolveAllClientConversations(clientId: number) {
    try {
        const contactLinks = await prisma.clientChatContact.findMany({
            where: { clientId },
            select: { contactId: true },
        });

        const contactIds = contactLinks.map((l) => l.contactId);
        if (contactIds.length === 0) return;

        const openConversations = await prisma.chatConversation.findMany({
            where: {
                contactId: { in: contactIds },
                status: "open",
            },
            select: { id: true },
        });

        if (openConversations.length === 0) return;

        const broadcaster = getBullMQBroadcaster();
        const conversationRepository = new PrismaConversationRepository();
        const resolveUseCase = new ResolveConversationUseCase(conversationRepository, broadcaster);

        for (const conv of openConversations) {
            await resolveUseCase.execute({ conversationId: conv.id });
        }

        console.log(`[ChatAction] Resolved ${openConversations.length} conversations for client ${clientId}`);
    } catch (error) {
        console.error(`[ChatAction] Erro ao resolver conversas do cliente ${clientId}:`, error);
    }
}
