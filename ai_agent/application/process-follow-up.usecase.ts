import { prisma } from "../../lib/prisma";
import { differenceInBusinessMinutes, isBusinessHour } from "../../lib/business-time";
import { FOLLOW_UP_CADENCE } from "../core/follow-up/cadence";
import { SendMessageUseCase } from "../../chat/application/send-message.usecase";
import { HumanMessage } from "@langchain/core/messages";
import { ReturnToResearchUseCase } from "../../chat/application/return-to-research.usecase";
import { ConsoleLLMAuditLogger } from "../core/audit/console-audit-logger";
import { followUpGraph } from "../core/follow-up/graph";
import { AgentTelemetry } from "@/ai_agent/infra/telemetry/agent-telemetry";
import { createPrismaKanbanRepository, updateClientKanbanState } from "../../domain/client/kanban-state-usecase";
import { UnassignChatbotUseCase } from "../../chatbot/application/unassign-chatbot.usecase";
import { PrismaChatbotSessionRepository } from "../../chatbot/infra/repositories/prisma-chatbot-session-repository";
import { BullMQChatbotStatusEmitter } from "../../chatbot/infra/realtime/bullmq-chatbot-status-emitter";
import { UserNotificationService } from "../infra/notifications/user-notification.service";
import { ResolveTemplateVariablesUseCase } from "../../chat/application/broadcast/resolve-template-variables.usecase";

export class ProcessFollowUpUseCase {
    private auditLogger = new ConsoleLLMAuditLogger();
    private unassignChatbot = new UnassignChatbotUseCase(
        new PrismaChatbotSessionRepository(),
        new BullMQChatbotStatusEmitter()
    );
    private resolveTemplateVariables = new ResolveTemplateVariablesUseCase(prisma);

    constructor(
        private sendMessageUseCase: SendMessageUseCase,
        private returnToResearchUseCase: ReturnToResearchUseCase
    ) { }

    async execute(conversationId: string) {
        try {
            console.log(`[FollowUp] 🔍 Iniciando análise para ${conversationId}`);

            // 1. Verificar se estamos em horário comercial
            if (!isBusinessHour(new Date())) {
                console.log(`[FollowUp] Bloqueio: Fora do horário comercial. Pulando ${conversationId}`);
                return;
            }

            // 2. Buscar dados da conversa e controle de follow-up
            const conversation = await prisma.chatConversation.findUnique({
                where: { id: conversationId },
                include: {
                    followUpControl: true,
                    chatbotSessions: {
                        where: { status: 'ACTIVE' },
                        take: 1
                    },
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        take: 20
                    }
                }
            });

            if (!conversation) {
                console.log(`[FollowUp] Conversa ${conversationId} não encontrada.`);
                return;
            }

            const activeSession = conversation.chatbotSessions?.[0];
            const sessionId = activeSession?.id;

            // [GAMBIARRA TEMPORÁRIA] Bloqueio de Follow-up para novos fluxos
            // Apenas o fluxo de vendas legado deve realizar follow-up automático.
            // O novo fluxo de pesquisa (cmms9okxa0001jl04p2ls4ap7) não terá recontato por aqui.
            if (!activeSession || activeSession.flowId !== "ai-agent-v1-flow") {
                console.log(`[FollowUp] Bloqueio: O fluxo ${activeSession?.flowId} não possui lógica de follow-up habilitada.`);
                return;
            }

            if (conversation.status !== 'open') {
                console.log(`[FollowUp] Conversa ${conversationId} ignorada: status é ${conversation.status}`);
                return;
            }

            // 3. SEGURANÇA: Se a última mensagem for do cliente, o vácuo acabou.
            const lastMessage = conversation.messages[0];
            if (lastMessage?.messageType === 'incoming') {
                console.log(`[FollowUp] Cliente respondeu a ${conversationId}. Removendo do controle.`);
                await prisma.chatFollowUpControl.deleteMany({ where: { conversationId } });
                return;
            }

            // 3.5. SEGURANÇA: Se a última mensagem tiver falha de entrega, dropar o follow-up.
            if (lastMessage?.status === 'failed') {
                console.log(`[FollowUp] ⚠️ Última mensagem com falha em ${conversationId}. Dropando follow-up.`);

                // Usar o use case correto — pausa + emite status pro frontend
                await this.unassignChatbot.execute({ conversationId });
                console.log(`[FollowUp] Chatbot desatribuído de ${conversationId} por falha de entrega.`);

                // Notificar o responsável (assignee ou vendedor) via serviço centralizado
                await UserNotificationService.notifyResponsible(
                    conversationId,
                    `⚠️ Falha de entrega detectada. O chatbot foi pausado. Verifique a conversa`
                );

                // Remover controle de follow-up para não tentar novamente
                await prisma.chatFollowUpControl.deleteMany({ where: { conversationId } });
                return;
            }

            // 4. Calcular tempo desde a ÚLTIMA ATIVIDADE
            const minutesSinceLastActivity = differenceInBusinessMinutes(new Date(), conversation.lastActivityAt);
            const control = conversation.followUpControl;
            const controlCount = control?.count || 0;

            // Detectar se o cliente já respondeu alguma coisa APÓS o início da sessão atual
            const hasResponded = conversation.messages.some(m =>
                m.messageType === 'incoming' &&
                activeSession &&
                m.createdAt > activeSession.createdAt
            );

            let step = FOLLOW_UP_CADENCE[controlCount];
            let nextCount = controlCount + 1;

            // LÓGICA DE RAMIFICAÇÃO:
            // Se o cliente JÁ respondeu algo (NÃO é vácuo total), pulamos o passo "esse_ainda_e_o_numero"
            // e vamos direto para o Judge no segundo recontato (que seria o Step 2).
            if (controlCount === 1 && hasResponded) {
                console.log(`[FollowUp] ⏩ Cliente já engajou em ${conversationId}. Pulando para o Judge.`);
                step = FOLLOW_UP_CADENCE[2]; // Pula para o Judge
                nextCount = 3;               // Marca como finalizado após esta execução
            }

            console.log(`[FollowUp] ⏱️ Vácuo para ${conversationId}: ${minutesSinceLastActivity} min úteis. (Passo Atual: ${controlCount})`);

            if (!step) {
                console.log(`[FollowUp] ✅ Fim da cadência para ${conversationId}. Mantendo trava para este ciclo.`);
                return;
            }

            if (minutesSinceLastActivity < step.delayMinutes) {
                console.log(`[FollowUp] ⏳ Ainda em vácuo aceitável. Próximo passo em ${step.delayMinutes - minutesSinceLastActivity} min.`);
                return;
            }

            console.log(`[FollowUp] 🚀 Executando ${step.type} para ${conversationId}`);

            // 4.5 LOCK: Marcar o início do processamento para o Cron Job não duplicar o job
            await prisma.chatFollowUpControl.upsert({
                where: { conversationId },
                create: { conversationId, lastFollowUpAt: new Date(), count: controlCount },
                update: { lastFollowUpAt: new Date() }
            });

            // 5. Executar a Ação baseada no Step
            if (step.type === 'FIXED') {
                await this.sendFixedMessage(conversation, step, sessionId);
                AgentTelemetry.fireAndForget("FOLLOWUP_FIXED", conversation.id, sessionId);
            } else if (step.type === 'IA_JUDGE') {
                await this.executeIAJudge(conversation, sessionId);
                AgentTelemetry.fireAndForget("FOLLOWUP_IA_JUDGE", conversation.id, sessionId);
            }

            // 5.5 Atualizar Kanban se o passo exigir
            if (step.kanbanCode !== undefined) {
                const clientId = activeSession?.variables && (activeSession.variables as any).clientId
                    ? Number((activeSession.variables as any).clientId)
                    : null;

                if (clientId) {
                    console.log(`[FollowUp] 📋 Movendo cliente ${clientId} para Kanban ${step.kanbanCode} (Step: ${controlCount})`);
                    const kanbanRepo = createPrismaKanbanRepository();
                    await updateClientKanbanState(kanbanRepo, clientId, step.kanbanCode);
                } else {
                    console.log(`[FollowUp] ⚠️ Aviso: Passo exige Kanban ${step.kanbanCode} mas nenhum clientId foi encontrado nas variáveis da sessão ${sessionId}.`);
                }
            }

            // 6. Atualizar controle (Trava de Fim de Ciclo)
            await prisma.chatFollowUpControl.upsert({
                where: { conversationId },
                create: {
                    conversationId,
                    count: nextCount,
                    lastFollowUpAt: new Date()
                },
                update: {
                    count: nextCount,
                    lastFollowUpAt: new Date()
                }
            });

            if (nextCount >= FOLLOW_UP_CADENCE.length) {
                console.log(`[FollowUp] ✅ Ciclo finalizado para ${conversationId}. Mantendo registro como trava.`);
            }

            console.log(`[FollowUp] ✨ Sucesso: ${conversationId}`);
        } catch (error: any) {
            console.error(`\n[FollowUp ERROR] ❌ Falha crítica em ${conversationId}:`);
            console.error(`> Motivo: ${error.message}`);
            if (error.stack) console.error(`> Stack: ${error.stack}`);
            throw error;
        }
    }

    private async sendFixedMessage(conversation: any, step: any, sessionId?: string) {
        // 1C: O cálculo de 24h deve ser em cima da última mensagem do CLIENTE
        const lastIncoming = await prisma.chatMessage.findFirst({
            where: {
                conversationId: conversation.id,
                messageType: 'incoming'
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
        });


        // Se não houver mensagem do cliente (lastIncoming é null), 
        // a janela de 24h NUNCA abriu. Então isWithin24h deve ser false.
        const isWithin24h = lastIncoming
            ? (new Date().getTime() - lastIncoming.createdAt.getTime()) < 24 * 60 * 60 * 1000
            : false;

        if (isWithin24h) {
            // Mensagem de texto simples
            await this.sendMessageUseCase.execute({
                conversationId: conversation.id,
                messageType: 'outgoing',
                contentType: 'text',
                content: step.content || "Conseguiu ver minha mensagem?",
                contentAttributes: { isFollowUp: true, sessionId }
            });
        } else {
            // RESOLUÇÃO GENÉRICA DE VARIÁVEIS
            let resolvedComponents = [];
            if (step.templateComponents && step.templateComponents.length > 0) {
                const activeSession = conversation.chatbotSessions?.[0];
                const clientId = activeSession?.variables && (activeSession.variables as any).clientId
                    ? Number((activeSession.variables as any).clientId)
                    : null;

                const resolvedTemplate = await this.resolveTemplateVariables.execute({
                    template: {
                        name: step.templateName || "conseguiu_ver_minha_mensagem",
                        languageCode: "pt_BR",
                        components: step.templateComponents
                    },
                    context: {
                        clientId: clientId,
                        contactId: conversation.contactId,
                    }
                });
                resolvedComponents = resolvedTemplate.components;
            }

            // Template de Utilidade (WhatsApp cobra por isso, mas permite abrir janela)
            await this.sendMessageUseCase.execute({
                conversationId: conversation.id,
                messageType: 'template', // 💡 IMPORTANTE: 'template' pula a trava de 24h no SendMessageUseCase
                contentType: 'template',
                contentAttributes: {
                    template: {
                        name: step.templateName || "conseguiu_ver_minha_mensagem",
                        languageCode: "pt_BR",
                        components: resolvedComponents
                    },
                    isFollowUp: true,
                    sessionId
                }
            });
        }
    }

    private async executeIAJudge(conversation: any, sessionId?: string) {
        const historyMessages = conversation.messages
            .reverse()
            .map((m: any) => new HumanMessage({
                content: `${m.messageType === 'incoming' ? 'Cliente' : 'Sistema'}: ${m.content}`
            }));

        console.log(`[FollowUp IA Judge] Iniciando Grafo de Decisão para ${conversation.id}...`);

        const startTime = Date.now();

        // Executar o mini-grafo do Juiz
        // O StateGraph gerencia automaticamente o loop de ferramentas se a IA solicitar
        const result = await followUpGraph.invoke({
            messages: historyMessages,
            conversation_id: conversation.id,
            session_id: sessionId
        }, {
            configurable: {
                conversation_id: conversation.id,
                session_id: sessionId
            },
            recursionLimit: 5 // Segurança: permite até 5 voltas, o suficiente para ações compostas
        });

        const decisions = (result.messages || [])
            .filter((m: any) => m.tool_calls && m.tool_calls.length > 0)
            .flatMap((m: any) => m.tool_calls.map((tc: any) => tc.name));

        console.log(`[FollowUp IA Judge] Decisões tomadas para ${conversation.id}: ${decisions.join(", ") || "NENHUMA (Continuar Vácuo)"}`);

        // 2: Logar auditoria de tokens e ferramentas (vindos do estado final do grafo)
        await this.auditLogger.log({
            model: "gemini-2.5-flash",
            usage: {
                promptTokens: result.usage.prompt_tokens,
                completionTokens: result.usage.completion_tokens,
                totalTokens: result.usage.total_tokens
            },
            latencyMs: Date.now() - startTime,
            decisions,
            correlationId: `fup-graph-${conversation.id}`
        });

        console.log(`[FollowUp IA Judge] Grafo finalizado para ${conversation.id}.`);
    }
}
