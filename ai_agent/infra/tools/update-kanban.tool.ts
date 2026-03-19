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

            // 1. Localizar o clientId (Prioriza Variáveis da Sessão, depois Busca no Banco via Contato)
            let clientId: number | null = null;
            
            const activeSession = await prisma.chatbotSession.findFirst({
                where: { conversationId, status: 'ACTIVE' },
                select: { variables: true, conversation: { select: { contactId: true } } }
            });

            if (activeSession?.variables && (activeSession.variables as any).clientId) {
                clientId = Number((activeSession.variables as any).clientId);
            } else if (activeSession?.conversation?.contactId) {
                // Se não tem na variável, busca pelo link do contato (Inbound Demo)
                const link = await prisma.clientChatContact.findFirst({
                    where: { contactId: activeSession.conversation.contactId },
                    select: { clientId: true }
                });
                clientId = link?.clientId || null;
            }

            if (!clientId) {
                return "Erro: Não foi possível localizar um Cliente vinculado a esta conversa para atualizar o Kanban.";
            }

            // 2. Executar atualização via Usecase
            const kanbanRepo = createPrismaKanbanRepository();
            await updateClientKanbanState(kanbanRepo, clientId, input.state);

            // 3. BROADCAST REALTIME
            // Busca a conversa atualizada para garantir que o front receba o novo status
            const conversation = await prisma.chatConversation.findFirst({
                where: { id: conversationId },
                include: { 
                    contact: { 
                        include: { 
                            clients: { 
                                include: { kanbanEstado: true } 
                            } 
                        } 
                    } 
                }
            });

            if (conversation) {
                // Importar dinamicamente para evitar ciclos ou erros de carregamento se necessário
                const { getBullMQBroadcaster } = await import("../../../chat/infra/events/bullmq-broadcaster");
                const broadcaster = getBullMQBroadcaster();
                
                await broadcaster.broadcast({
                    type: 'conversation.updated',
                    payload: conversation
                });

                console.log(`[UpdateKanban Tool] Real-time broadcast sent for ${conversationId}`);
            }

            return `Estado do cliente no Kanban atualizado para o código ${input.state} com sucesso.`;
        } catch (error: any) {
            console.error("[UpdateKanban Tool] Error:", error);
            return `Erro ao atualizar Kanban: ${error.message}`;
        }
    },
    {
        name: "update_kanban_status",
        description: `Mova o cliente para uma nova etapa no Funil de Vendas (CRM/Kanban) com base no progresso da conversa.
Códigos de status:
0: A fazer contato (Lead novo)
1: Contato feito (Conversa iniciada/Ana respondendo)
5: Interessado (Cliente demonstrou interesse real em produto ou preço)
6: Negociando (Cliente está decidindo modelos, pedindo orçamentos ou detalhes técnicos avançados)
7: Venda Realizada (Venda concluída!)
8: Perdido (Cliente desistiu ou não tem interesse)

USE ESTA FERRAMENTA toda vez que identificar uma mudança clara de intenção do cliente. Ex: Se ele perguntar "quanto custa?", mova para 5(Interessado). Se ele começar a fechar detalhes de entrega, mova para 6(Negociando).`,
        schema: z.object({
            state: z.number().describe("O código numérico do novo estado (0, 1, 5, 6, 7, 8)"),
            reason: z.string().optional().describe("Motivo da mudança (ex: 'Cliente pediu orçamento')"),
        }),
    }
);
