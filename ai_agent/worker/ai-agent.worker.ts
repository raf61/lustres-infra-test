import { Worker, ConnectionOptions } from "bullmq";
import { AI_AGENT_QUEUE_NAME } from "../infra/queue/ai-agent.queue";
import { PrismaChatbotSessionRepository } from "../../chatbot/infra/repositories/prisma-chatbot-session-repository";
import { PrismaClientRepository } from "../../chat/infra/repositories/prisma-client-repository";
import { PrismaMessageRepository } from "../../chat/infra/repositories/prisma-message-repository";
import { PrismaConversationRepository } from "../../chat/infra/repositories/prisma-conversation-repository";
import { SendMessageUseCase } from "../../chat/application/send-message.usecase";
import { UnassignChatbotUseCase } from "../../chatbot/application/unassign-chatbot.usecase"; // IMPORT ADDED
import { BullMQChatbotStatusEmitter } from "../../chatbot/infra/realtime/bullmq-chatbot-status-emitter"; // IMPORT ADDED
import { getActiveGraph } from "../core/active-graph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { prisma } from "../../lib/prisma";

const sessionRepo = new PrismaChatbotSessionRepository();
const messageRepo = new PrismaMessageRepository();
const conversationRepo = new PrismaConversationRepository();
const sendMessageUseCase = new SendMessageUseCase(messageRepo, conversationRepo);

// Camada de Auditoria desacoplada (LLM-Only)
import { ConsoleLLMAuditLogger } from "../core/audit/console-audit-logger";
const auditLogger = new ConsoleLLMAuditLogger();

// Inicializar UseCase de Unassign para Circuit Breaker
const statusEmitter = new BullMQChatbotStatusEmitter();
const unassignChatbotUseCase = new UnassignChatbotUseCase(sessionRepo, statusEmitter);

function buildConnection(): ConnectionOptions {
    const host = process.env.BULLMQ_REDIS_HOST;
    const port = Number(process.env.BULLMQ_REDIS_PORT);
    const username = process.env.BULLMQ_REDIS_USERNAME;
    const password = process.env.BULLMQ_REDIS_PASSWORD;

    if (!host || !port) {
        throw new Error("Missing BULLMQ_REDIS_HOST or BULLMQ_REDIS_PORT");
    }

    return {
        host,
        port,
        ...(username ? { username } : {}),
        ...(password ? { password } : {}),
    };
}

let workerStarted = false;

export const ensureAiAgentWorker = () => {
    if (workerStarted) return;
    workerStarted = true;

    new Worker(AI_AGENT_QUEUE_NAME, async (job) => {
        const { conversationId, messageId } = job.data;
        console.log(`[AI Agent] Processing message ${messageId} for conversation ${conversationId}`);

        try {
            // 1. Load Session & Validation (Circuit Breaker)
            const session = await sessionRepo.findActiveByConversation(conversationId);
            if (!session || !session.flowId) {
                console.log(`[AI Agent] No active session for ${conversationId}, skipping.`);
                return;
            }

            // 2. Safety Check: Verify if session is paused/failed externally
            const currentStatus = session.status as any;
            if (currentStatus === 'PAUSED' || currentStatus === 'FAILED') {
                console.log(`[AI Agent] Session ${session.id} is ${currentStatus}, skipping execution.`);
                return;
            }

            // 1.5. Load Flow e buscar Preset HARDCODED
            const flow = await prisma.chatbotFlow.findUnique({
                where: { id: session.flowId },
                select: { id: true, name: true }
            });

            // Importa e usa preset hardcoded (não depende de config no banco)
            const { getPresetForFlow } = await import("../core/presets");
            const preset = getPresetForFlow(session.flowId, flow?.name);

            // 2. Load Client Data
            const conversation = await conversationRepo.findById(conversationId);
            let clientData: Record<string, any> = {};

            // Prioridade 1: Buscar do clientId salvo na sessão (pelo disparo de outbound)
            const sessionVars = session.variables as Record<string, any>;
            const sessionClientId = sessionVars?.clientId;

            if (sessionClientId) {
                const client = await prisma.client.findUnique({
                    where: { id: Number(sessionClientId) }
                });
                if (client) {
                    clientData = {
                        clientId: client.id,
                        name: client.razaoSocial,
                        syndic: client.nomeSindico,
                        phone: client.telefoneSindico,
                        email: client.emailSindico,
                        flowId: session.flowId,
                        inboxId: (conversation as any)?.inboxId
                    };
                }
            }

            // Prioridade 2: Fallback para busca via contato (se não houver clientId na sessão)
            if (!clientData.clientId && conversation?.contactId) {
                const contact = await prisma.chatContact.findUnique({
                    where: { id: conversation.contactId },
                    include: { clients: { include: { client: true } } }
                });

                if (contact && contact.clients.length > 0) {
                    const client = contact.clients[0].client;
                    clientData = {
                        clientId: client.id,
                        name: client.razaoSocial,
                        syndic: client.nomeSindico,
                        phone: client.telefoneSindico,
                        email: client.emailSindico,
                        flowId: session.flowId,
                        inboxId: (conversation as any)?.inboxId
                    };
                } else if (contact) {
                    clientData = {
                        name: contact.name,
                        phone: contact.waId,
                        flowId: session.flowId,
                        inboxId: (conversation as any)?.inboxId
                    };
                }
            }

            // 3. Load History (Capped at 500 messages)
            const MAX_HISTORY = 500;
            const historyFetchLimit = preset.maxHistoryMessages || 100; // Prefer larger history if not specified

            const history = await prisma.chatMessage.findMany({
                where: { conversationId },
                orderBy: { createdAt: 'desc' },
                take: Math.min(historyFetchLimit, MAX_HISTORY)
            });

            const storedMessages = history.reverse().map(m => {
                const timestamp = m.createdAt.toLocaleString('pt-BR');

                // Helper to label media messages for the AI
                let displayContent = m.content || "";
                if (['image', 'audio', 'video', 'document', 'sticker'].includes(m.contentType || "")) {
                    const label = {
                        image: "Imagem",
                        audio: "Áudio",
                        video: "Vídeo",
                        document: "Documento",
                        sticker: "Figurinha"
                    }[m.contentType as string] || "Arquivo";

                    if (!displayContent) {
                        displayContent = `(${label} enviado pelo cliente)`;
                    } else {
                        displayContent = `(${label} com legenda: ${displayContent})`;
                    }
                }

                const contentWithTime = `[${timestamp}] ${displayContent}`;

                if (m.messageType === 'incoming') return new HumanMessage({ content: contentWithTime, id: m.id });
                return new AIMessage({ content: contentWithTime, id: m.id });
            });

            // 4. Run Graph
            console.log(`[AI Agent] Using preset: ${preset.name}`);
            const inputs = {
                messages: storedMessages,
                summary: session.conversationSummary || "",
                client_data: clientData,
                conversation_id: conversationId,
                session_id: session.id,
                message_id: messageId,
                custom_system_prompt: preset.systemPrompt, // Prompt HARDCODED do preset
            };

            const config = {
                configurable: {
                    conversation_id: conversationId,
                    session_id: session.id,
                    message_id: messageId
                }
            };

            console.log(`[AI Agent] Invoking graph for ${conversationId}`);

            // TRY/CATCH ESPECÍFICO PARA A EXECUÇÃO DA IA
            let output;
            const startTime = Date.now();
            try {
                const graph = getActiveGraph(session.flowId);

                if (!graph) {
                    console.warn(`[AI-Worker] ⚠️ No graph found for flowId: ${session.flowId}. Skipping processing.`);
                    return;
                }

                output = await graph.invoke(inputs, config);
                const latency = Date.now() - startTime;

                // Capturar decisões (ferramentas chamadas)
                const decisions = output.messages
                    .filter((m: any) => m instanceof AIMessage && m.tool_calls && m.tool_calls.length > 0)
                    .flatMap((m: any) => m.tool_calls.map((tc: any) => tc.name));

                // 6. Auditoria de Sucesso (LLM-Agnostic)
                await auditLogger.log({
                    correlationId: conversationId, // Apenas ID de correlação
                    model: "gemini-2.5-flash",
                    usage: {
                        promptTokens: output.usage_report?.prompt || 0,
                        completionTokens: output.usage_report?.completion || 0,
                        totalTokens: output.usage_report?.total || 0
                    },
                    decisions,
                    latencyMs: latency
                });

            } catch (graphError: any) {
                const latency = Date.now() - startTime;
                console.error(`[AI Agent] Graph Execution Failed:`, graphError);

                await auditLogger.log({
                    correlationId: conversationId,
                    model: "gemini-2.5-flash",
                    usage: { prompt: 0, completion: 0, total: 0 } as any,
                    error: graphError.message,
                    latencyMs: latency
                });

                // USE CASE CORRETO: UnassignChatbotUseCase
                // Responsabilidade única: pausar sessão e emitir evento de inatividade
                await unassignChatbotUseCase.execute({ conversationId: conversationId });
                console.log(`[AI Agent] Session unassigned due to critical error: ${graphError.message}`);

                throw graphError; // Rethrow para o BullMQ marcar como failed
            }

            // 5. Process Output
            const lastMessage = output.messages[output.messages.length - 1];
            const newSummary = output.summary;

            // Update Summary
            if (newSummary && newSummary !== session.conversationSummary) {
                await sessionRepo.update(session.id, { conversationSummary: newSummary });
                console.log(`[AI Agent] Summary updated for session ${session.id}`);
            }

            // Send Response
            if (lastMessage instanceof AIMessage && lastMessage.content) {
                const content = lastMessage.content;

                // Se o conteúdo for uma string, verificamos o protocolo [SILENCE]
                // Se for um objeto/array (artifact do LangChain/Gemini), tratamos como silêncio se estiver vazio
                const isSilence = typeof content === 'string'
                    ? content.trim() === '[]' || content.trim() === ''
                    : Array.isArray(content) && content.length === 0;

                // Detect decisions (tools called) — feito antes do isSilence para cobrir resolução silenciosa
                const decisions = output.messages
                    .filter((m: any) => m instanceof AIMessage && m.tool_calls && m.tool_calls.length > 0)
                    .flatMap((m: any) => m.tool_calls.map((tc: any) => tc.name));

                const wasResolved = decisions.includes('resolve_conversation');

                if (!isSilence) {
                    let messagesToSend: string[] = [];
                    try {
                        const jsonMatch = typeof content === 'string' ? content.match(/```json\s*([\s\S]*?)\s*```/) : null;
                        const source = jsonMatch ? jsonMatch[1].trim() : (typeof content === 'string' ? content.trim() : content);

                        const parsed = typeof source === 'string' ? JSON.parse(source) : source;
                        if (Array.isArray(parsed)) {
                            messagesToSend = parsed.filter(m => typeof m === 'string' && m.trim() !== "" && m !== "[]");
                        } else {
                            messagesToSend = [typeof source === 'string' ? source : JSON.stringify(source)];
                        }
                    } catch (e) {
                        const fallback = typeof content === 'string' ? content.replace(/```json|```/g, "").trim() : JSON.stringify(content);
                        if (fallback && fallback !== "[]") {
                            messagesToSend = [fallback];
                        }
                    }

                    // Envia cada mensagem por vez com delay de 1s
                    for (let i = 0; i < messagesToSend.length; i++) {
                        const msg = messagesToSend[i];
                        if (!msg || msg === '[]' || msg.trim() === '') continue;

                        await sendMessageUseCase.execute({
                            conversationId,
                            content: msg,
                            messageType: "outgoing",
                            contentAttributes: wasResolved ? { skipReopen: true } : undefined as any
                        });

                        // Delay de 1s se não for a última mensagem
                        if (i < messagesToSend.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1500)); // levemente maior para melhor percepção
                        }
                    }
                } else if (wasResolved) {
                    // IA resolveu a conversa mas não enviou nenhuma mensagem (silêncio).
                    // O resolveConversationTool já alterou o status no banco — não há risco de reabertura aqui.
                    console.log(`[AI Agent] Conversation resolved with silence. Status is already 'resolved'.`);
                } else {
                    console.log(`[AI Agent] Silence Protocol: AI decided not to send a message.`);
                }
            }

        } catch (error) {
            console.error(`[AI Agent] Error processing job ${job.id}:`, error);
            // BullMQ irá retry se configurado, ou marcar failed.
            throw error;
        }

    }, {
        connection: buildConnection(),
        concurrency: Number(process.env.AI_AGENT_CONCURRENCY || 1),
        limiter: {
            max: 10,
            duration: 1000
        }
    });

    console.log("[AI Agent] Worker started");
}
