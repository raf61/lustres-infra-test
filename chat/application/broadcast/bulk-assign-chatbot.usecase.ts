import { PrismaClient } from "@prisma/client";
import { BulkEnsureContactsUseCase } from "./bulk-ensure-contacts.usecase";
import { BulkEnsureContactInboxesUseCase } from "./bulk-ensure-contact-inboxes.usecase";
import { BulkEnsureConversationsUseCase } from "./bulk-ensure-conversations.usecase";
import { normalizeContacts } from "../utils/normalize-contacts";
import { BullMQChatbotStatusEmitter } from "../../../chatbot/infra/realtime/bullmq-chatbot-status-emitter";

export type BulkAssignChatbotInput = {
    inboxId: string;
    chatbotFlowId: string;
    assigneeId: string; // user performing the action
    contacts: Array<{
        phoneNumber: string;
        contactName?: string | null;
        clientId?: number | null;
    }>;
};

export type BulkAssignChatbotResult = {
    accepted: number;
    invalid: string[];
    processed: number;
    errors: number;
};

/**
 * BulkAssignChatbotUseCase
 *
 * Assigns a chatbot flow to multiple contacts in bulk WITHOUT dispatching messages.
 * This is 100% bulk optimized. No N+1 queries. Zero message side-effects.
 * It strictly creates the conversation, links the client, and INSERTS the ChatbotSession.
 * It will skip conversations that already have an ACTIVE session.
 */
export class BulkAssignChatbotUseCase {
    constructor(private readonly prisma: PrismaClient) { }

    async execute(input: BulkAssignChatbotInput): Promise<BulkAssignChatbotResult> {
        const { inboxId, chatbotFlowId, contacts } = input;

        console.log("[BulkAssignChatbot] start", {
            inboxId,
            chatbotFlowId,
            contacts: contacts.length,
        });

        // 1. Validate inbox & flow
        const inbox = await this.prisma.chatInbox.findUnique({ where: { id: inboxId } });
        if (!inbox) throw new Error(`INBOX_NOT_FOUND: Inbox ${inboxId} does not exist`);

        const flow = await this.prisma.chatbotFlow.findUnique({ where: { id: chatbotFlowId } });
        if (!flow || !flow.active) throw new Error("CHATBOT_FLOW_INVALID: Fluxo não encontrado ou inativo.");
        if (flow.type !== "OUTBOUND") throw new Error("CHATBOT_FLOW_INVALID: Apenas fluxos OUTBOUND são permitidos.");
        if (flow.engine !== "AI_AGENT") throw new Error("CHATBOT_FLOW_INVALID: Apenas fluxos AI_AGENT são permitidos.");

        // 2. Normalize phone numbers
        const { valid, invalid } = normalizeContacts(contacts);
        if (valid.length === 0) return { accepted: 0, invalid, processed: 0, errors: 0 };

        // 3. Ensure contacts, inboxes & conversations via existing bulk usecases
        const bulkEnsureContacts = new BulkEnsureContactsUseCase();
        const contactMap = await bulkEnsureContacts.execute(
            valid.map((c) => ({ phoneNumber: c.phoneNumber, contactName: c.contactName ?? null }))
        );



        // 3.1 Find ALL existing conversations for these contacts, to pick the latest one across all inboxes
        // Requirement: "atribuir na conversa mais recente, se já houver. só se não houver, cria na inbox escolhida"
        const contactIds = Array.from(new Set(Array.from(contactMap.values()).map(c => c.id)));
        const latestConversations = await this.prisma.chatConversation.findMany({
            where: { contactId: { in: contactIds } },
            orderBy: [
                { contactId: 'asc' },
                { lastActivityAt: 'desc' }
            ],
            distinct: ['contactId'],
            select: { id: true, contactId: true, inboxId: true, assigneeId: true }
        });

        const conversationMap = new Map<string, any>();
        for (const conv of latestConversations) {
            conversationMap.set(conv.contactId, conv);
        }

        // 3.2 For contacts with NO conversation, ensure them in the target inboxId
        const missingSeeds = valid.filter(c => {
            const record = contactMap.get(c.phoneNumber);
            return record && !conversationMap.has(record.id);
        }).map(c => {
            const record = contactMap.get(c.phoneNumber)!;
            return {
                inboxId,
                phoneNumber: c.phoneNumber,
                contactId: record.id,
                contactName: c.contactName ?? null
            };
        });

        if (missingSeeds.length > 0) {
            const bulkEnsureContactInboxes = new BulkEnsureContactInboxesUseCase();
            await bulkEnsureContactInboxes.execute(
                missingSeeds.map(s => ({ contactId: s.contactId, inboxId: s.inboxId, sourceId: s.phoneNumber }))
            );

            const bulkEnsureConversations = new BulkEnsureConversationsUseCase();
            const newlyCreatedMap = await bulkEnsureConversations.execute(missingSeeds);

            for (const [cid, conv] of newlyCreatedMap.entries()) {
                conversationMap.set(cid, conv);
            }
        }

        // 4. Bulk fetch Client data for variables (nomeSindico, razaoSocial, etc)
        const clientIds = [...new Set(valid.map(c => c.clientId).filter(Boolean) as number[])];
        let clientsMap = new Map<number, any>();
        if (clientIds.length > 0) {
            const clients = await this.prisma.client.findMany({
                where: { id: { in: clientIds } },
                select: { id: true, razaoSocial: true, cnpj: true, nomeSindico: true, logradouro: true, numero: true, complemento: true, cidade: true }
            });
            clientsMap = new Map(clients.map(c => [c.id, c]));
        }

        // 5. Bulk Ensure Client <-> Contact Links (no N+1 ensureLink)
        const clientContactLinks = valid.map(c => {
            const contactId = contactMap.get(c.phoneNumber)?.id;
            return (c.clientId && contactId) ? { clientId: c.clientId, contactId } : null;
        }).filter(Boolean) as { clientId: number, contactId: string }[];

        if (clientContactLinks.length > 0) {
            await this.prisma.clientChatContact.createMany({
                data: clientContactLinks,
                skipDuplicates: true,
            });
        }

        // 6. Gather target conversations to process
        const targetConversations = valid.map(c => {
            const contactId = contactMap.get(c.phoneNumber)?.id;
            if (!contactId) return null;
            const conversation = conversationMap.get(contactId);
            if (!conversation || !conversation.id) return null;
            return {
                contact: c,
                contactId,
                conversationId: conversation.id,
                conversation, // include to use its actual inboxId
                client: c.clientId ? clientsMap.get(c.clientId) : null,
            };
        }).filter(Boolean) as Array<{
            contact: BulkAssignChatbotInput["contacts"][0],
            contactId: string,
            conversationId: string,
            conversation: any,
            client: any
        }>;

        const conversationIdsToProcess = targetConversations.map(t => t.conversationId);

        // 7. Find existing active sessions. WE WILL SKIP THESE as requested.
        const existingActiveSessions = await this.prisma.chatbotSession.findMany({
            where: {
                conversationId: { in: conversationIdsToProcess },
                status: "ACTIVE"
            },
            select: { conversationId: true }
        });
        const existingActiveConvIds = new Set(existingActiveSessions.map(s => s.conversationId));

        const conversationsToCreate = targetConversations.filter(t => !existingActiveConvIds.has(t.conversationId));

        // 8. Bulk Create Chatbot Sessions directly (Zero events, zero messages)
        const sessionsToInsert = conversationsToCreate.map(t => {
            const contactName = t.contact.contactName || "Contato";
            const razaoSocial = t.client?.razaoSocial || t.contact.contactName;
            const endereco = t.client ? `${t.client.logradouro}, ${t.client.numero}${t.client.complemento ? ' - ' + t.client.complemento : ''}` : "endereço cadastrado";

            const variables = {
                contactName,
                nome_pessoa: contactName,
                nome_condominio: razaoSocial,
                razao_social: razaoSocial,
                endereco,
                phoneNumber: t.contact.phoneNumber,
                clientId: t.contact.clientId ?? null,
                contactId: t.contactId,
                conversationId: t.conversationId,
                inboxId: t.conversation.inboxId,
                "client.razaoSocial": razaoSocial,
                "client.cnpj": t.client?.cnpj,
                "client.nomeSindico": t.client?.nomeSindico || contactName,
                "client.logradouro": t.client?.logradouro,
                "client.cidade": t.client?.cidade,
                "contact.name": contactName,
            };

            return {
                conversationId: t.conversationId,
                flowId: chatbotFlowId,
                status: "ACTIVE" as const,
                currentStepId: null,
                variables,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        });

        if (sessionsToInsert.length > 0) {
            await this.prisma.chatbotSession.createMany({
                data: sessionsToInsert,
            });

            // Notificar realtime: ícone de bot aparece no dashboard do vendedor imediatamente
            // 1 único round-trip Redis para N conversas (zero N+1)
            const statusEmitter = new BullMQChatbotStatusEmitter();
            await statusEmitter.bulkEmitActive(
                conversationsToCreate.map((t) => ({
                    conversationId: t.conversationId,
                    flowId: chatbotFlowId,
                    inboxId: t.conversation.inboxId,
                }))
            );
        }

        console.log("[BulkAssignChatbot] done", {
            processed: sessionsToInsert.length,
            errors: 0,
            skipped: existingActiveConvIds.size,
            invalid: invalid.length
        });

        return {
            accepted: valid.length,
            invalid,
            processed: sessionsToInsert.length,
            errors: 0,
        };
    }
}
