import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { PrismaChatbotSessionRepository } from "../../../chatbot/infra/repositories/prisma-chatbot-session-repository";
import { PrismaConversationRepository } from "../../../chat/infra/repositories/prisma-conversation-repository";
import { AgentTelemetry } from "@/ai_agent/infra/telemetry/agent-telemetry";
import { AgentStateAnnotation } from "../../core/state";
import { UserNotificationService } from "../notifications/user-notification.service";
import { getBullMQBroadcaster } from "../../../chat/infra/events/bullmq-broadcaster";
import { BullMQChatbotStatusEmitter } from "../../../chatbot/infra/realtime/bullmq-chatbot-status-emitter";
import { prisma } from "../../../lib/prisma";


const sessionRepo = new PrismaChatbotSessionRepository();
const conversationRepo = new PrismaConversationRepository();

export const handoffTool = tool(
    async (input, config) => {
        try {
            const conversationId = config.configurable?.conversation_id;
            if (!conversationId) return "Erro: Conversation ID não encontrado.";

            // 1. Encerrar sessão do Chatbot
            const session = await sessionRepo.findActiveByConversation(conversationId);
            let assignedVendorId: string | null = null;
            let vendorMatchReason = "";

            if (session) {
                await sessionRepo.update(session.id, {
                    status: "COMPLETED",
                    variables: {
                        ...session.variables as Record<string, any>,
                        handoff_reason: input.reason
                    }
                });

                // LÓGICA ESPECIAL: Atribuição por nome específico ou aleatória
                if (session.flowId === "cmmwk5hgv0001jv2rv3jzt5ms") {
                    try {
                        // 1.1 Tentar buscar por nome se fornecido
                        if (input.target_vendor_name) {
                            const matchedVendor = await prisma.user.findFirst({
                                where: {
                                    role: "VENDEDOR",
                                    active: true,
                                    OR: [
                                        { name: { contains: input.target_vendor_name, mode: 'insensitive' } },
                                        { fullname: { contains: input.target_vendor_name, mode: 'insensitive' } }
                                    ]
                                },
                                select: { id: true, name: true }
                            });

                            if (matchedVendor) {
                                assignedVendorId = matchedVendor.id;
                                vendorMatchReason = ` (pediu por ${matchedVendor.name})`;
                                console.log(`[Handoff] Atribuindo vendedor específico ${matchedVendor.name} (${assignedVendorId})`);
                            }
                        }

                        // 1.2 Fallback para aleatório se não encontrou por nome
                        if (!assignedVendorId) {
                            const activeVendors = await prisma.user.findMany({
                                where: {
                                    role: "VENDEDOR",
                                    active: true
                                },
                                select: { id: true }
                            });

                            if (activeVendors.length > 0) {
                                const randomIndex = Math.floor(Math.random() * activeVendors.length);
                                assignedVendorId = activeVendors[randomIndex].id;
                                console.log(`[Handoff] Atribuindo vendedor aleatório ${assignedVendorId} para o fluxo Inbound Lustres.`);
                            }
                        }
                    } catch (vendorError) {
                        console.error("[Handoff] Erro ao buscar vendedores:", vendorError);
                    }
                }
            }

            // 2. Buscar conversa atual para checar assignee existente
            const currentConv = await prisma.chatConversation.findUnique({
                where: { id: conversationId },
                select: { assigneeId: true, contactId: true }
            });

            // 3. Buscar vendedor na carteira do cliente (Fidelidade) se a conversa não tiver dono
            let portfolioVendorId: string | null = null;
            try {
                const contactWithClient = await prisma.chatContact.findUnique({
                    where: { id: currentConv?.contactId },
                    include: { clients: { include: { client: { select: { vendedorId: true } } } } }
                });
                
                // Pega o vendedorId do primeiro cliente vinculado ao contato
                portfolioVendorId = contactWithClient?.clients[0]?.client?.vendedorId || null;
                if (portfolioVendorId) {
                    // Verificar se o vendedor da carteira ainda está ativo
                    const isActive = await prisma.user.findFirst({
                        where: { id: portfolioVendorId, active: true, role: "VENDEDOR" }
                    });
                    if (!isActive) portfolioVendorId = null;
                }
            } catch (err) {
                console.error("[Handoff] Erro ao buscar fidelidade do cliente:", err);
            }

            // 4. Marcar conversa como PENDENTE/ABERTA para humanos e atribuir se necessário
            // Ordem de prioridade (Novo Handoff): 
            // 1. Vendedor escolhido/sorteado pelo bot (assignedVendorId)
            // 2. Vendedor da carteira (portfolioVendorId)
            // 3. Manter o dono atual APENAS se nenhum novo for encontrado
            const finalAssigneeId = assignedVendorId || portfolioVendorId || currentConv?.assigneeId;

            console.log(`[Handoff] Definindo novo responsável para a conversa: ${finalAssigneeId}`);

            const updatedConversation = await prisma.chatConversation.update({
                where: { id: conversationId },
                data: {
                    status: "open",
                    assigneeId: finalAssigneeId // Forçamos a atribuição/sobreposição
                }
            });


            // 4. Registro no ClientRegistro e associação de vendedor no Client
            if (finalAssigneeId) {
                try {
                    const contact = await prisma.chatContact.findUnique({
                        where: { id: updatedConversation.contactId },
                        include: { clients: { include: { client: true } } }
                    });

                    if (contact && contact.clients.length > 0) {
                        const clientId = contact.clients[0].clientId;
                        
                        // Atualizar vendedor no Client
                        await prisma.client.update({
                            where: { id: clientId },
                            data: { vendedorId: finalAssigneeId }
                        });

                        // Criar registro no histórico [I.A]
                        const truncatedReason = input.reason.length > 50 ? input.reason.substring(0, 47) + "..." : input.reason;
                        
                        // NOTA: Tentar criar o registro mas não falhar se houver erro de sequência (Unique Constraint ID)
                        try {
                            await prisma.clientRegistro.create({
                                data: {
                                    clientId: clientId,
                                    userId: finalAssigneeId,
                                    mensagem: `[I.A] handoff${vendorMatchReason} - ${truncatedReason}`
                                }
                            });
                            console.log(`[Handoff] Registro criado para cliente ${clientId} por ${finalAssigneeId}.`);
                        } catch (regError: any) {
                            if (regError.code === 'P2002') {
                                console.warn(`[Handoff] ⚠️ Erro de duplicidade no ID do registro (sequence desatualizada). Ignorando...`);
                            } else {
                                throw regError;
                            }
                        }
                    }
                } catch (assignError) {
                    console.error("[Handoff] Erro no pós-atribuição do cliente:", assignError);
                }
            }

            // Notificar realtime (dashboard atualiza sem refresh)
            const broadcaster = getBullMQBroadcaster();
            await broadcaster.broadcast({
                type: "conversation.updated",
                payload: {
                    conversationId,
                    inboxId: updatedConversation.inboxId,
                    status: "open",
                    waitingSince: updatedConversation.waitingSince,
                    lastActivityAt: updatedConversation.lastActivityAt,
                    assigneeId: updatedConversation.assigneeId,
                },
            });

            // Sumir com o ícone do robô na UI do vendedor
            if (session) {
                const statusEmitter = new BullMQChatbotStatusEmitter();
                await statusEmitter.emitInactive({
                    conversationId,
                    sessionId: session.id,
                    flowId: session.flowId,
                    reason: "HANDOFF",
                });
            }
            // Registrar métrica
            const sessionId = config.configurable?.session_id;
            AgentTelemetry.fireAndForget("HANDOFF", conversationId, sessionId);

            // Notificar o vendedor responsável
            UserNotificationService.notifyResponsible(conversationId, `Handoff solicitado: ${input.reason}`);

            return `Transbordo realizado. Motivo: ${input.reason}. A conversa agora está na fila de atendimento humano.`;

        } catch (error: any) {
            return `Erro ao realizar handoff: ${error.message}`;
        }
    },
    {
        name: "handoff_to_human",
        description: "Transfere a conversa SILENCIOSAMENTE para um atendente humano. Use quando: (1) cliente aceitou agendar visita, (2) cliente fez pergunta técnica que você não sabe responder, (3) situação complexa. NÃO avise o cliente sobre a transferência.",
        schema: z.object({
            reason: z.string().describe("Motivo interno da transferência (ex: cliente_aceitou, pergunta_tecnica, nao_sei_responder)"),
            target_vendor_name: z.string().optional().describe("Nome do vendedor específico citado pelo cliente no chat, se houver."),
        }),
    }
);

