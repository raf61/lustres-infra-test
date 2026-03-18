import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { PrismaChatbotSessionRepository } from "../../../chatbot/infra/repositories/prisma-chatbot-session-repository";
import { PrismaConversationRepository } from "../../../chat/infra/repositories/prisma-conversation-repository";
import { AgentTelemetry } from "@/ai_agent/infra/telemetry/agent-telemetry";
import { AgentStateAnnotation } from "../../core/state";
import { UserNotificationService } from "../notifications/user-notification.service";
import { getBullMQBroadcaster } from "../../../chat/infra/events/bullmq-broadcaster";
import { BullMQChatbotStatusEmitter } from "../../../chatbot/infra/realtime/bullmq-chatbot-status-emitter";

const sessionRepo = new PrismaChatbotSessionRepository();
const conversationRepo = new PrismaConversationRepository();

export const handoffTool = tool(
    async (input, config) => {
        try {
            const conversationId = config.configurable?.conversation_id;
            if (!conversationId) return "Erro: Conversation ID não encontrado.";

            // 1. Encerrar sessão do Chatbot
            const session = await sessionRepo.findActiveByConversation(conversationId);
            if (session) {
                await sessionRepo.update(session.id, {
                    status: "COMPLETED",
                    variables: {
                        ...session.variables as Record<string, any>,
                        handoff_reason: input.reason
                    }
                });
            }

            // 2. Marcar conversa como PENDENTE/ABERTA para humanos
            const updatedConversation = await conversationRepo.updateStatus(conversationId, "open");

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
        }),
    }
);
