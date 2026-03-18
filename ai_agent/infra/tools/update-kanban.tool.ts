import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { prisma } from "@/lib/prisma";
import { createPrismaKanbanRepository, updateClientKanbanState } from "../../../domain/client/kanban-state-usecase";

/**
 * Ferramenta para atualizar o estado do cliente no Kanban.
 * Segue o padrão de Clean Architecture e desacoplamento.
 */
export const updateKanbanTool = tool(
    async (input, config) => {
        try {
            const conversationId = config.configurable?.conversation_id;
            if (!conversationId) {
                return "Erro: ID da conversa não encontrado no contexto.";
            }

            console.log(`[UpdateKanban Tool] Updating kanban for conversation ${conversationId} to state ${input.state}`);

            // 1. Localizar a sessão ativa e extrair o clientId das variáveis
            const activeSession = await prisma.chatbotSession.findFirst({
                where: {
                    conversationId,
                    status: 'ACTIVE'
                },
                select: { variables: true }
            });

            const clientId = activeSession?.variables && (activeSession.variables as any).clientId
                ? Number((activeSession.variables as any).clientId)
                : null;

            if (!clientId) {
                return "Erro: Não foi possível localizar o 'clientId' nas variáveis da sessão ativa do chatbot. O Kanban não pode ser atualizado sem esta referência.";
            }

            // 2. Executar atualização via Usecase para manter regras de negócio
            const kanbanRepo = createPrismaKanbanRepository();
            await updateClientKanbanState(kanbanRepo, clientId, input.state);

            return `Estado do cliente no Kanban atualizado para ${input.state} com sucesso.`;
        } catch (error: any) {
            console.error("[UpdateKanban Tool] Error:", error);
            return `Erro ao atualizar Kanban: ${error.message}`;
        }
    },
    {
        name: "update_kanban_state",
        description: `Altera a coluna do cliente no funil de vendas (Kanban).
Códigos válidos:
0: A fazer contato (Lead novo ou resetado)
1: Contato feito (Lead já respondeu)
2: Follow-up 1 (Primeiro recontato)
3: Follow-up 2 (Segundo recontato - Verificação de número)
4: Ignorado (Lead não responde a múltiplos lembretes - vácuo total)

USE PRINCIPALMENTE O CÓDIGO 4("Ignorado") quando o lead for totalmente improdutivo e ignorar a gente`,
        schema: z.object({
            state: z.number().describe("O código numérico do novo estado no Kanban (0-4)"),
            reason: z.string().optional().describe("Motivo da mudança de estado (para log)"),
        }),
    }
);
