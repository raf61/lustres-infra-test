import { Worker } from "bullmq";
import { PrismaChatbotFlowRepository } from "../infra/repositories/prisma-chatbot-flow-repository";
import { PrismaChatbotSessionRepository } from "../infra/repositories/prisma-chatbot-session-repository";
import { PrismaChatbotInboxDefaultRepository } from "../infra/repositories/prisma-chatbot-inbox-default-repository";
import { StartChatbotUseCase } from "../application/start-chatbot.usecase";
import { ContinueChatbotUseCase } from "../application/continue-chatbot.usecase";
import { AutoAssignChatbotUseCase } from "../application/auto-assign-chatbot.usecase";
import { DisableChatbotOnAgentMessageUseCase } from "../application/disable-chatbot-on-agent-message.usecase";
import { UnassignChatbotUseCase } from "../application/unassign-chatbot.usecase";
import { SendMessageUseCase } from "../../chat/application/send-message.usecase";
import { PrismaMessageRepository } from "../../chat/infra/repositories/prisma-message-repository";
import { PrismaConversationRepository } from "../../chat/infra/repositories/prisma-conversation-repository";
import { buildChatbotConnection } from "../infra/queue/chatbot-events.queue";
import { PrismaChatbotPathEventRepository } from "../infra/repositories/prisma-chatbot-path-event-repository";
import { SendMessageChatbotAdapter } from "../infra/senders/send-message-adapter";
import { BullMQChatbotStatusEmitter } from "../infra/realtime/bullmq-chatbot-status-emitter";
import { getBullMQBroadcaster } from "../../chat/infra/events/bullmq-broadcaster";
import { SystemChatbotActionProvider } from "../infra/actions/system-actions-adapter";
import { prisma } from "../../lib/prisma";
import { getAiAgentQueue } from "../../ai_agent/infra/queue/ai-agent.queue";
import { UserNotificationService } from "../../ai_agent/infra/notifications/user-notification.service";
import { ResolveConversationUseCase } from "../../chat/application/resolve-conversation.usecase";
import { createPrismaKanbanRepository, updateClientKanbanState } from "../../domain/client/kanban-state-usecase";

type ChatEventJob = {
  type: string;
  payload: any;
  occurredAt?: Date;
};

const flowRepository = new PrismaChatbotFlowRepository();
const sessionRepository = new PrismaChatbotSessionRepository();
const pathEventRepository = new PrismaChatbotPathEventRepository();
const inboxDefaultRepository = new PrismaChatbotInboxDefaultRepository();
const statusEmitter = new BullMQChatbotStatusEmitter();

const messageRepository = new PrismaMessageRepository();
const conversationRepository = new PrismaConversationRepository();
const sendMessageUseCase = new SendMessageUseCase(
  messageRepository,
  conversationRepository
);
const messageSender = new SendMessageChatbotAdapter(sendMessageUseCase);
const broadcaster = getBullMQBroadcaster();
const actionProvider = new SystemChatbotActionProvider(prisma);

const startChatbotUseCase = new StartChatbotUseCase(
  flowRepository,
  sessionRepository,
  pathEventRepository,
  messageSender,
  actionProvider,
  statusEmitter
);
const continueChatbotUseCase = new ContinueChatbotUseCase(
  flowRepository,
  sessionRepository,
  pathEventRepository,
  messageSender,
  actionProvider,
  statusEmitter
);
const autoAssignChatbotUseCase = new AutoAssignChatbotUseCase(
  inboxDefaultRepository,
  sessionRepository,
  flowRepository,
  conversationRepository,
  startChatbotUseCase
);
const disableChatbotOnAgentMessageUseCase = new DisableChatbotOnAgentMessageUseCase(
  sessionRepository,
  pathEventRepository,
  statusEmitter
);
const unassignChatbotUseCase = new UnassignChatbotUseCase(
  sessionRepository,
  statusEmitter
);

const checkAndRouteToAiAgent = async (
  sessionId: string,
  conversationId: string,
  messageId: string,
  content: string
): Promise<boolean> => {
  const session = await sessionRepository.findById(sessionId);
  if (!session) return false;
  const flow = await flowRepository.findById(session.flowId);
  if (!flow || !flow.active || flow.engine !== "AI_AGENT") return false;

  const queue = getAiAgentQueue();
  await queue.add(
    "ai-agent-input",
    { conversationId, messageId }, // Passamos o messageId apenas como referência inicial
    {
      jobId: `debounce-ai-${conversationId}`, // Impede a criação de múltiplos jobs pendentes para a mesma conversa
      delay: 17000, // Espera 17 segundos para "agrupar" possíveis mensagens vindo em sequência
      removeOnComplete: true
    }
  );
  return true;
};

const g = globalThis as any;

export function ensureChatbotEventsWorker() {
  if (g.__chatbotEventsWorkerStarted) return;


  new Worker<ChatEventJob>(
    "chatbot-events-queue",
    async (job) => {
      console.log("job.data", job.data);
      const { type, payload } = job.data;

      // ─────────────────────────────────────────────────────────────────────────
      // EVENTO: conversation.status_changed
      // Encerra sessão do chatbot quando conversa é resolvida
      // ─────────────────────────────────────────────────────────────────────────
      if (type === 'conversation.status_changed') {
        const { conversationId, status } = payload;
        if (status === 'resolved') {
          console.log(`[ChatbotEventsWorker] Terminating chatbot session for resolved conversation ${conversationId}`);
          await unassignChatbotUseCase.execute({ conversationId });
        }
        return;
      }

      // ─────────────────────────────────────────────────────────────────────────
      // EVENTO: message.failed
      // Reage a falhas de envio apenas para sessões AI_AGENT ativas
      // 131026 = número inválido/não está no WhatsApp
      // 131049 = limite de marketing atingido (pode tentar outro dia)
      // ─────────────────────────────────────────────────────────────────────────
      if (type === 'message.failed') {
        const { conversationId, externalError } = payload;
        if (!conversationId || !externalError) return;

        const activeSession = await sessionRepository.findActiveByConversation(conversationId);
        // For failures, we only react if there is an active session (robot/AI dispatches)
        if (!activeSession) return;

        const flow = await flowRepository.findById(activeSession.flowId);
        if (!flow || flow.engine !== 'AI_AGENT') return;

        const resolveUseCase = new ResolveConversationUseCase(conversationRepository, broadcaster);
        await resolveUseCase.execute({ conversationId });

        // 131026 = número inválido/não está no WhatsApp
        if (externalError.includes('131026')) {
          // await UserNotificationService.notifyResponsible(
          //   conversationId,
          //   'Número não está no WhatsApp — disparo não entregue. Mande para a pesquisa'
          // );
        }

        // TODOS OS ERROS (incluindo 131049) mandam de volta pro kanban 0
        let clientId: number | null = null;

        // 1. Tenta pegar das variáveis da sessão
        if (activeSession.variables && (activeSession.variables as any).clientId) {
          clientId = Number((activeSession.variables as any).clientId);
        }

        // 2. Se não estiver na sessão, busca via conversa -> contato -> cliente (Garante que vai funcionar)
        if (!clientId || isNaN(clientId)) {
          const conv = await conversationRepository.findByIdWithRelations(conversationId);
          if (conv && conv.contact.clients && conv.contact.clients.length > 0) {
            clientId = conv.contact.clients[0].id;
          }
        }

        if (clientId) {
          const kanbanRepo = createPrismaKanbanRepository();
          await updateClientKanbanState(kanbanRepo, clientId, 0); // Vai para "A fazer contato"
          console.log(`[ChatbotEventsWorker] Reset kanban for client ${clientId} due to failure: ${externalError}`);
        }

        console.log(`[ChatbotEventsWorker] Message ${type} handled for ${conversationId}. Error: ${externalError}`);
        return;
      }

      // ─────────────────────────────────────────────────────────────────────────
      // EVENTO: message.created
      // ─────────────────────────────────────────────────────────────────────────
      if (type !== "message.created") return;
      if (!payload) return;
      const messageType = payload.messageType;

      const conversationId = payload.conversationId;
      const inboxId = payload.inboxId;
      if (!conversationId || !inboxId) return;

      if (messageType === "incoming") {
        const incomingText = (payload.content || "").trim();
        const interactiveId =
          payload.contentAttributes?.interactive?.button?.id ||
          payload.contentAttributes?.interactive?.list?.id ||
          null;
        const interactiveTitle =
          payload.contentAttributes?.interactive?.button?.title ||
          payload.contentAttributes?.interactive?.list?.title ||
          null;
        const hasUserInput = Boolean(incomingText || interactiveId || interactiveTitle);

        if (hasUserInput) {
          const autoAssignResult = await autoAssignChatbotUseCase.execute({
            conversationId,
            inboxId,
            isNewConversation: payload.isNewConversation,
            isReopenedConversation: payload.isReopenedConversation,
          });
          if (autoAssignResult?.started) {
            if (autoAssignResult.session) {
              await checkAndRouteToAiAgent(
                autoAssignResult.session.id,
                conversationId,
                payload.id,
                incomingText
              );
            }
            return;
          }

          const activeSession =
            await sessionRepository.findActiveByConversation(conversationId);

          if (activeSession) {
            // 1. Tentar rotear para IA (checkAndRouteToAiAgent retorna true se o fluxo for engine=AI_AGENT)
            const routed = await checkAndRouteToAiAgent(
              activeSession.id,
              conversationId,
              payload.id,
              incomingText
            );
            if (routed) return;

            // 2. Se não foi roteado para IA e não tem currentStepId, é um fluxo legado pendente
            if (!activeSession.currentStepId) {
              await startChatbotUseCase.execute({
                conversationId,
                flowId: activeSession.flowId,
              });
              return;
            }
          }
        } else {
          const existingSession =
            await sessionRepository.findActiveByConversation(conversationId);
          if (!existingSession) return;

          const routed = await checkAndRouteToAiAgent(
            existingSession.id,
            conversationId,
            payload.id,
            incomingText
          );
          if (routed) return;
        }

        let continueResult: any;
        try {
          continueResult = await continueChatbotUseCase.execute({
            conversationId,
            incomingMessage: incomingText,
            interactiveId,
          });
        } catch (err: any) {
          console.error(`[ChatbotEventsWorker] Error in chatbot execution for conversation ${conversationId}:`, err.message);

          const session = await sessionRepository.findActiveByConversation(conversationId);
          if (session) {
            await sessionRepository.update(session.id, {
              status: "PAUSED",
              currentStepId: null,
              lastInteractionAt: new Date(),
            });
          }

          const now = new Date();
          const updated = await conversationRepository.updateActivity(conversationId, now, now);

          const unreadCount = await conversationRepository.countUnreadMessages(conversationId, updated.agentLastSeenAt || null);
          const lastIncoming = await conversationRepository.getLastIncomingMessageTimestamp(conversationId);
          const canReply = lastIncoming ? (now.getTime() - lastIncoming.getTime()) / (1000 * 60 * 60) < 24 : false;

          await broadcaster.broadcast({
            type: 'conversation.updated',
            payload: {
              conversationId,
              inboxId: updated.inboxId,
              status: updated.status,
              waitingSince: updated.waitingSince,
              lastActivityAt: updated.lastActivityAt,
              assigneeId: updated.assigneeId,
              agentLastSeenAt: updated.agentLastSeenAt,
              unreadCount,
              canReply,
            }
          });

          // Notificar inactivade do chatbot (para sumir com o robô na UI)
          if (session) {
            await statusEmitter.emitInactive({
              conversationId,
              sessionId: session.id,
              flowId: session.flowId,
              reason: "error",
            });
          }
          return;
        }

        if (continueResult?.handoff) {
          const now = new Date();
          const updated = await conversationRepository.updateActivity(conversationId, now, now);

          const unreadCount = await conversationRepository.countUnreadMessages(conversationId, updated.agentLastSeenAt || null);
          const lastIncoming = await conversationRepository.getLastIncomingMessageTimestamp(conversationId);
          const canReply = lastIncoming ? (now.getTime() - lastIncoming.getTime()) / (1000 * 60 * 60) < 24 : false;

          await broadcaster.broadcast({
            type: 'conversation.updated',
            payload: {
              conversationId,
              inboxId: updated.inboxId,
              status: updated.status,
              waitingSince: updated.waitingSince,
              lastActivityAt: updated.lastActivityAt,
              assigneeId: updated.assigneeId,
              agentLastSeenAt: updated.agentLastSeenAt,
              unreadCount,
              canReply,
            }
          });
        }

        if (continueResult && continueResult.session.status !== "ACTIVE") {
          await statusEmitter.emitInactive({
            conversationId,
            sessionId: continueResult.session.id,
            flowId: continueResult.session.flowId,
            reason: continueResult.session.status,
          });
        }
        return;
      }
      if (
        (messageType === "outgoing" || messageType === "template") &&
        payload.contentAttributes?.senderId
      ) {
        // Se a mensagem tiver a flag keepChatbot, verificamos se a sessão atual é de IA.
        // Apenas Chatbots de IA suportam receber mensagens externas e continuar ativos.
        if (payload.contentAttributes?.keepChatbot === true) {
          const activeSession = await sessionRepository.findActiveByConversation(conversationId);
          if (activeSession) {
            const flow = await flowRepository.findById(activeSession.flowId);
            if (flow?.engine === "AI_AGENT") {
              console.log(`[ChatbotEventsWorker] Keeping AI Agent session active for conversation ${conversationId}`);
              return;
            }
            console.log(`[ChatbotEventsWorker] Ignoring keepChatbot for non-AI flow (${flow?.engine}) in conversation ${conversationId}`);
          }
        }

        await disableChatbotOnAgentMessageUseCase.execute({
          conversationId,
          senderId: payload.contentAttributes?.senderId,
        });
      }
    },
    {
      connection: buildChatbotConnection(),
      concurrency: Number(process.env.BULLMQ_CHATBOT_EVENTS_CONCURRENCY || 2),
    }
  ).on("failed", (job, err) => {
    console.error(`[ChatbotEventsWorker] Job ${job?.id} failed:`, err.message);
  });

  g.__chatbotEventsWorkerStarted = true;
  console.log("[ChatbotEventsWorker] Worker initialized");
}

ensureChatbotEventsWorker();
