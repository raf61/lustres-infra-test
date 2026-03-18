import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { ReturnToResearchUseCase } from "../../../chat/application/return-to-research.usecase";
import { PrismaConversationRepository } from "../../../chat/infra/repositories/prisma-conversation-repository";
import { PrismaChatbotSessionRepository } from "../../../chatbot/infra/repositories/prisma-chatbot-session-repository";
import { PrismaClientChatContactRepository } from "../../../chat/infra/repositories/prisma-client-chat-contact-repository";
import { UnassociateClientFromConversationUseCase } from "../../../chat/application/unassociate-client-from-conversation.usecase";
import { AgentTelemetry } from "@/ai_agent/infra/telemetry/agent-telemetry";
import { UserNotificationService } from "../notifications/user-notification.service";
import { resolveAllClientConversations } from "../../../chat/application/resolve-all-client-conversations";

const conversationRepository = new PrismaConversationRepository();
const chatbotSessionRepository = new PrismaChatbotSessionRepository();
const unassociateUseCase = new UnassociateClientFromConversationUseCase(
    conversationRepository,
    new PrismaClientChatContactRepository()
);
const returnToResearchUseCase = new ReturnToResearchUseCase(conversationRepository);

export const returnToResearchTool = tool(
    async (input, config) => {
        try {
            const conversationId = config.configurable?.conversation_id;
            if (!conversationId) return "Erro: ID da conversa não encontrado no contexto seguro.";

            console.log(`[ReturnToResearch Tool] Intent: Returning conversation ${conversationId} to research.`);

            // 1. PRIORIDADE: Verificar se a conversa existe e pegar o responsável
            const conversation = await conversationRepository.findByIdWithRelations(conversationId);
            if (!conversation) {
                return "Erro: Conversa não encontrada.";
            }

            let finalClientId: number | null = null;

            // 2. Tentar clientId via sessão (disparo outbound)
            const activeSession = await chatbotSessionRepository.findActiveByConversation(conversationId);
            if (activeSession && activeSession.variables && (activeSession.variables as any).clientId) {
                finalClientId = Number((activeSession.variables as any).clientId);
                console.log(`[ReturnToResearch Tool] Found clientId ${finalClientId} in active session variables.`);
            }

            // 3. Tentar clientId via relações da conversa
            if (!finalClientId) {
                const clients = conversation.contact.clients || [];
                if (clients.length === 0) {
                    return "Erro: Este contato não possui um cliente vinculado para ser retornado à pesquisa.";
                }

                finalClientId = Number(clients[0].id);
                console.log(`[ReturnToResearch Tool] Found clientId ${finalClientId} via contact relations fallback.`);
            }

            // Identificar o responsável pela ação (Log)
            // Se a conversa tiver um atendente (assignee), usamos ele. Caso contrário, usamos o Master (ID 1).
            const finalUserId = conversation.assigneeId || "1";

            // 4. Chamar o usecase consolidado
            const result = await returnToResearchUseCase.execute({
                clientId: finalClientId,
                userId: finalUserId,
                reason: input.reason || "IA identificou que contato não é o síndico e não sabe quem é."
            });

            // 5. Desassociar contato ↔ cliente da conversa
            try {
                await unassociateUseCase.execute({ conversationId, clientId: finalClientId });
                console.log(`[ReturnToResearch Tool] Unassociated clientId=${finalClientId} from conversation ${conversationId}`);
            } catch (linkErr: any) {
                console.warn(`[ReturnToResearch Tool] unassociate falhou (não crítico): ${linkErr.message}`);
            }

            // 6. Resolver todas as conversas do cliente (fire-and-forget, mesmo padrão da perda)
            resolveAllClientConversations(finalClientId).catch((err: any) =>
                console.error(`[ReturnToResearch Tool] Erro ao resolver conversas em background:`, err)
            );

            // Registrar métrica
            const sessionId = config.configurable?.session_id;
            AgentTelemetry.fireAndForget("RETURN_RESEARCH", conversationId, sessionId);

            // Notificar o vendedor responsável
            UserNotificationService.notifyResponsible(conversationId, `Ficha retornada para Pesquisa: ${input.reason || "Contato incorreto"}`);

            return `Contato (Cliente ID ${result.clientId}) retornado à pesquisa com sucesso. Ficha ID: ${result.fichaId}.`;
        } catch (error: any) {
            console.error("[ReturnToResearch Tool] Error:", error);
            return `Erro ao retornar para pesquisa: ${error.message}`;
        }
    },
    {
        name: "return_to_research",
        description: `Marca o contato para retornar ao setor de pesquisa (Pesquisador).
USE QUANDO:
- O contato atual NÃO é o síndico.
- E o contato atual afirmou que NÃO sabe/não tem o telefone do novo síndico.
Esta ferramenta remove o cliente do dashboard do vendedor, desvincula o contato da conversa, resolve a conversa e cria uma ficha em pesquisa.`,
        schema: z.object({
            reason: z.string().optional().describe("Motivo do retorno à pesquisa (ex: contato_antigo_sem_novo_numero)"),
        }),
    }
);
