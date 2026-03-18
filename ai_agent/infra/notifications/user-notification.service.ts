import { prisma } from "@/lib/prisma";

/**
 * Serviço responsável por criar notificações para os usuários (vendedores)
 * de forma desacoplada e segura.
 */
export class UserNotificationService {
    /**
     * Cria uma notificação direta para um usuário específico
     */
    static async notify(userId: string, content: string) {
        try {
            await prisma.userNotification.create({
                data: {
                    userId,
                    content,
                }
            });
            console.log(`[Notification] ✨ Enviada para User ${userId}: ${content}`);
        } catch (error: any) {
            // Silencioso para não quebrar o fluxo principal da I.A.
            console.error(`[Notification ERROR] ❌ Falha ao criar notificação para ${userId}:`, error.message);
        }
    }

    /**
     * Tenta identificar o vendedor responsável pelo contato/conversa e envia a notificação.
     * Segue a hierarquia: Assignee da Conversa -> Vendedor do Cliente vinculado ao Contato.
     */
    static async notifyResponsible(conversationId: string, content: string) {
        try {
            const conversation = await prisma.chatConversation.findUnique({
                where: { id: conversationId },
                include: {
                    contact: {
                        include: {
                            clients: {
                                take: 1, // Geralmente um contato principal
                                include: {
                                    client: {
                                        select: {
                                            vendedorId: true,
                                            razaoSocial: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!conversation) return;

            // 1. Tenta o assigneeId da conversa
            let targetUserId = conversation.assigneeId;

            // 2. Se não tiver, tenta o vendedor do cliente vinculado
            const contactClients = conversation.contact?.clients || [];
            if (!targetUserId && contactClients.length > 0) {
                targetUserId = contactClients[0].client.vendedorId;
            }

            if (targetUserId) {
                // Se encontramos um responsável, enviamos a notificação
                // Adicionamos o nome do cliente se disponível para melhor contexto
                const clientName = contactClients[0]?.client?.razaoSocial
                    || conversation.contact?.name
                    || "Contato Desconhecido";
                const enrichedContent = `[${clientName}] ${content}`;

                await this.notify(targetUserId, enrichedContent);
            } else {
                console.log(`[Notification] ⚠️ Nenhum responsável encontrado para a conversa ${conversationId}.`);
            }
        } catch (error: any) {
            console.error(`[Notification ERROR] ❌ Falha técnica:`, error.message);
        }
    }
}
