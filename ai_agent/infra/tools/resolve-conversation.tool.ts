import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { ResolveConversationUseCase } from "../../../chat/application/resolve-conversation.usecase";
import { PrismaConversationRepository } from "../../../chat/infra/repositories/prisma-conversation-repository";
import { BullMQBroadcaster } from "../../../chat/infra/events/bullmq-broadcaster";
import { AgentTelemetry } from "@/ai_agent/infra/telemetry/agent-telemetry";

const conversationRepository = new PrismaConversationRepository();
const broadcaster = new BullMQBroadcaster();
const resolveConversationUseCase = new ResolveConversationUseCase(conversationRepository, broadcaster);

export const resolveConversationTool = tool(
    async (input, config) => {
        try {
            const conversationId = config.configurable?.conversation_id;
            if (!conversationId) {
                return "Erro: ID da conversa não encontrado no contexto seguro.";
            }

            console.log(`[ResolveConversation Tool] Resolving conversation ${conversationId}`);

            const result = await resolveConversationUseCase.execute({
                conversationId: conversationId,
            });

            if (result.wasAlreadyResolved) {
                return "Conversa já estava resolvida.";
            }

            // Registrar métrica
            const sessionId = config.configurable?.session_id;
            AgentTelemetry.fireAndForget("RESOLVED", conversationId, sessionId);

            return "Conversa encerrada com sucesso.";
        } catch (error: any) {
            console.error("[ResolveConversation Tool] Error:", error);
            return `Erro ao encerrar conversa: ${error.message}`;
        }
    },
    {
        name: "resolve_conversation",
        description: `Encerra a conversa atual.`,
        schema: z.object({
            reason: z.string().optional().describe("Motivo do encerramento (para logs internos)"),
        }),
    }
);
