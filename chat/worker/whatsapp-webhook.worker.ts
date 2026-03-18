import { ensureWhatsappWebhookWorker } from "../infra/queue/whatsapp-webhook.queue";
import { HandleInboundUseCase } from "../application/handle-inbound.usecase";
import { HandleStatusUseCase, InboundStatus } from "../application/handle-status.usecase";
import { PrismaInboxRepository } from "../infra/repositories/prisma-inbox-repository";
import { PrismaContactRepository } from "../infra/repositories/prisma-contact-repository";
import { PrismaContactInboxRepository } from "../infra/repositories/prisma-contact-inbox-repository";
import { PrismaConversationRepository } from "../infra/repositories/prisma-conversation-repository";
import { PrismaMessageRepository } from "../infra/repositories/prisma-message-repository";
import { getBullMQBroadcaster } from "../infra/events/bullmq-broadcaster";
import { normalizeMessage, extractStatuses } from "../webhook/server";
import { InboundMessage } from "../domain/message";

const inboxRepo = new PrismaInboxRepository();
const contactRepo = new PrismaContactRepository();
const contactInboxRepo = new PrismaContactInboxRepository();
const convRepo = new PrismaConversationRepository();
const messageRepo = new PrismaMessageRepository();
const broadcaster = getBullMQBroadcaster();

const handleInbound = new HandleInboundUseCase(inboxRepo, contactRepo, contactInboxRepo, convRepo, messageRepo, broadcaster);
const handleStatus = new HandleStatusUseCase(messageRepo, contactRepo, contactInboxRepo, broadcaster);

ensureWhatsappWebhookWorker(async (jobData) => {
    const { payload } = jobData;
    const entry = payload?.entry || [];

    for (const e of entry) {
        const changes = e.changes || [];

        for (const change of changes) {
            const value = change.value || {};
            const metadata = value.metadata;
            const contact = value.contacts?.[0];
            const profileName = contact?.profile?.name;

            // 1. Processar Mensagens
            if (value.messages && value.messages.length > 0) {
                const filteredMessages = value.messages.filter((m: any) => m.type !== 'reaction');
                if (filteredMessages.length === 0) continue;

                // Aqui o fetchMediaMeta (que é pesado) acontece de forma assíncrona fora do request da Meta
                const normalizedMessages = await Promise.all(
                    filteredMessages.map((m: any) => normalizeMessage(m, metadata, profileName))
                );

                // Logs Detalhados para Paridade de 100%
                normalizedMessages.forEach((m: any) => {
                    const base = {
                        id: m.id,
                        from: m.from,
                        type: m.type,
                        timestamp: m.timestamp,
                        phoneNumberId: m.phoneNumberId,
                        displayPhoneNumber: m.displayPhoneNumber,
                    };

                    switch (m.type) {
                        case 'text':
                            console.log('[webhook-listener] message:text', { ...base, text: m.text });
                            break;
                        case 'image':
                        case 'video':
                        case 'audio':
                        case 'document':
                        case 'sticker':
                            console.log('[webhook-listener]', `message:${m.type}`, {
                                ...base,
                                caption: m.caption,
                                mediaId: m.mediaId,
                            });
                            break;
                        case 'location':
                            console.log('[webhook-listener] message:location', { ...base, location: m.location });
                            break;
                        case 'contacts':
                            console.log('[webhook-listener] message:contacts', { ...base, contacts: m.contacts });
                            break;
                        case 'interactive':
                            console.log('[webhook-listener] message:interactive', { ...base, interactive: m.interactive });
                            break;
                        case 'reaction':
                            console.log('[webhook-listener] message:reaction', { ...base, reaction: m.reaction });
                            break;
                        default:
                            console.log('[webhook-listener] message:other', m);
                            break;
                    }
                });

                await handleInbound.execute(normalizedMessages as InboundMessage[]);
                console.log(`[WhatsappWorker] Processed ${normalizedMessages.length} messages`);
            }

            // 2. Processar Statuses
            if (value.statuses && value.statuses.length > 0) {
                const normalizedStatuses = extractStatuses(value);

                normalizedStatuses.forEach((s: any) => {
                    console.log('[webhook-listener] status', {
                        id: s.id,
                        status: s.status,
                        recipientId: s.recipientId,
                    });
                });

                await handleStatus.execute(normalizedStatuses as InboundStatus[]);
                console.log(`[WhatsappWorker] Processed ${normalizedStatuses.length} statuses`);
            }
        }
    }
});

console.log("[whatsapp-webhook.worker] Worker initialized");
