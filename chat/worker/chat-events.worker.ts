import { ensureChatEventsWorker } from '../infra/queue/chat-events.queue';
import { PrismaConversationRepository } from '../infra/repositories/prisma-conversation-repository';
import { getBullMQBroadcaster } from '../infra/events/bullmq-broadcaster';
import { Conversation } from '../domain/conversation';
import { AutoAssignConversationUseCase } from '../application/auto-assign-conversation.usecase';
import { prisma } from '../../lib/prisma';

// Instanciar dependências
const conversationRepository = new PrismaConversationRepository();
const broadcaster = getBullMQBroadcaster();
const autoAssignConversationUseCase = new AutoAssignConversationUseCase(conversationRepository);

// ============================================================================
// RESPONSABILIDADES SEPARADAS
// ============================================================================

/**
 * RESPONSABILIDADE 1: Reabertura de Conversa
 * - Qualquer mensagem (incoming, outgoing, template) reabre se estava fechada
 */
async function handleConversationReopen(
  conversation: Conversation,
  conversationId: string,
  messageType: string,
  skipReopen?: boolean
): Promise<{ conversation: Conversation; changed: boolean }> {
  // 1. Se a flag skipReopen estiver ativa (via IA), nunca reabre
  if (skipReopen) return { conversation, changed: false };

  // Reabre se não estiver aberta
  if (conversation.status !== 'open') {
    console.log(`[ChatEventsWorker] Reopening conversation ${conversationId} (was: ${conversation.status})`);
    const updated = await conversationRepository.updateStatus(conversationId, 'open');
    return { conversation: updated, changed: true };
  }
  return { conversation, changed: false };
}

/**
 * RESPONSABILIDADE 2: Atualização de Atividade para INCOMING
 * - Atualiza lastActivityAt
 * - Marca waitingSince (início da espera por resposta)
 */
async function handleIncomingActivity(
  conversation: Conversation,
  conversationId: string,
  now: Date
): Promise<{ conversation: Conversation; changed: boolean }> {
  // Se não tem waitingSince, é a primeira msg não respondida
  if (!conversation.waitingSince) {
    const updated = await conversationRepository.updateActivity(conversationId, now, now);
    return { conversation: updated, changed: true };
  } else {
    const updated = await conversationRepository.updateActivity(conversationId, now);
    return { conversation: updated, changed: true };
  }
}

/**
 * RESPONSABILIDADE 3: Atualização de Atividade para OUTGOING
 * - Atualiza lastActivityAt
 * - Limpa waitingSince (cliente foi respondido)
 */
async function handleOutgoingActivity(
  conversation: Conversation,
  conversationId: string,
  now: Date,
  ignoreWaitingSince?: boolean
): Promise<{ conversation: Conversation; changed: boolean }> {
  // Se a flag estiver presente, forçamos o "now" (fila de espera).
  // Caso contrário, limpamos (null) - comportamento padrão de resposta.
  const waitingSince = ignoreWaitingSince ? now : null;

  const updated = await conversationRepository.updateActivity(conversationId, now, waitingSince);
  return { conversation: updated, changed: true };
}

/**
 * RESPONSABILIDADE 4: Auto-Atribuição de Agente
 * - Se não tem assignee e a msg tem senderId, atribui
 */
async function handleAutoAssignment(
  conversation: Conversation,
  conversationId: string,
  senderId?: string
): Promise<{ conversation: Conversation; changed: boolean }> {
  if (!senderId) return { conversation, changed: false };

  const result = await autoAssignConversationUseCase.execute({
    conversationId,
    senderId,
  });

  if (result.changed) {
    console.log(`[ChatEventsWorker] Auto-assigning ${senderId} to conversation ${conversationId}`);
  }

  return result;
}

/**
 * RESPONSABILIDADE 5: Reset de Follow-up
 * - Qualquer mensagem nova (incoming ou outgoing) zera a cadência de follow-up
 */
async function handleFollowUpReset(conversationId: string): Promise<void> {
  await prisma.chatFollowUpControl.deleteMany({
    where: { conversationId }
  });
}

// ============================================================================
// WORKER PRINCIPAL
// ============================================================================

ensureChatEventsWorker(async (job) => {
  const { type, payload } = job;

  // ─────────────────────────────────────────────────────────────────────────
  // EVENTO: message.created
  // ÚNICO evento que precisa de lógica no worker
  // Processa: reopen, waitingSince, assignee, e depois faz broadcast
  // ─────────────────────────────────────────────────────────────────────────
  if (type === 'message.created') {
    const message = payload;
    const { conversationId, messageType } = message;

    // Buscar estado atual da conversa
    let conversation = await conversationRepository.findById(conversationId);
    if (!conversation) return;

    const now = new Date();
    let conversationChanged = false;
    let result: { conversation: Conversation; changed: boolean };

    // PASSO 1: REABRIR CONVERSA (para qualquer tipo de mensagem)
    result = await handleConversationReopen(
      conversation,
      conversationId,
      messageType,
      message.contentAttributes?.skipReopen
    );
    conversation = result.conversation;
    conversationChanged = conversationChanged || result.changed;

    // PASSO 2: ATUALIZAR ATIVIDADE (depende do tipo de mensagem)
    if (messageType === 'incoming') {
      result = await handleIncomingActivity(conversation, conversationId, now);
      conversation = result.conversation;
      conversationChanged = conversationChanged || result.changed;
    }

    if (messageType === 'outgoing' || messageType === 'template') {
      const ignoreWaitingSince = message.contentAttributes?.ignoreWaitingSince === true;
      result = await handleOutgoingActivity(conversation, conversationId, now, ignoreWaitingSince);
      conversation = result.conversation;
      conversationChanged = conversationChanged || result.changed;

      // PASSO 3: AUTO-ATRIBUIÇÃO (só para outgoing/template)
      const senderId = message.contentAttributes?.senderId;
      result = await handleAutoAssignment(conversation, conversationId, senderId);
      conversation = result.conversation;
      conversationChanged = conversationChanged || result.changed;
    }

    // PASSO 4: RESET DE FOLLOW-UP (Apenas se NÃO for uma mensagem do próprio sistema de follow-up)
    const isFollowUp = message.contentAttributes?.isFollowUp === true;
    if (!isFollowUp) {
      await handleFollowUpReset(conversationId);
    }

    // ─────────────────────────────────────────────────────────────────────
    // CALCULAR UNREAD COUNT (igual ao Chatwoot)
    // Mensagens incoming criadas após agentLastSeenAt
    // ─────────────────────────────────────────────────────────────────────
    const unreadCount = await conversationRepository.countUnreadMessages(
      conversationId,
      conversation.agentLastSeenAt || null
    );

    // ─────────────────────────────────────────────────────────────────────
    // CALCULAR canReply (igual ao Chatwoot)
    // canReply = última msg incoming foi há menos de 24h
    // Se acabou de chegar uma msg incoming, canReply = true
    // ─────────────────────────────────────────────────────────────────────
    const canReply = messageType === 'incoming'
      ? true  // Mensagem incoming acabou de chegar = janela de 24h reiniciada
      : await conversationRepository.getLastIncomingMessageTimestamp(conversationId)
        .then(lastIncoming => {
          if (!lastIncoming) return false;
          const hoursDiff = (now.getTime() - lastIncoming.getTime()) / (1000 * 60 * 60);
          return hoursDiff < 24;
        });

    // ─────────────────────────────────────────────────────────────────────
    // BROADCASTS
    // ─────────────────────────────────────────────────────────────────────

    // Broadcast: Conversa foi atualizada (se mudou)
    if (conversationChanged) {
      await broadcaster.broadcast({
        type: 'conversation.updated',
        payload: {
          conversationId,
          inboxId: conversation.inboxId,  // ← Necessário para routing
          status: conversation.status,
          waitingSince: conversation.waitingSince,
          lastActivityAt: conversation.lastActivityAt,
          assigneeId: conversation.assigneeId,
          agentLastSeenAt: conversation.agentLastSeenAt,
          unreadCount,  // ← Incluir unreadCount
          canReply,     // ← Incluir canReply
        },
      });
    }

    // Broadcast: Nova mensagem criada
    // Inclui dados da conversa (igual ao Chatwoot) para que o frontend
    // possa atualizar lastActivityAt, unreadCount e reordenar a lista
    await broadcaster.broadcast({
      type: 'message.created',
      payload: {
        ...message,
        inboxId: conversation.inboxId,  // ← Necessário para routing
        conversation: {
          id: conversationId,
          inboxId: conversation.inboxId,
          lastActivityAt: conversation.lastActivityAt,
          status: conversation.status,
          waitingSince: conversation.waitingSince,
          agentLastSeenAt: conversation.agentLastSeenAt,
          unreadCount,  // ← Incluir unreadCount (igual ao Chatwoot)
          canReply,     // ← Incluir canReply
        },
      },
    });
  }

  // Outros eventos (message.updated, conversation.created, conversation.updated)
  // agora vão DIRETO para broadcasts-queue, não passam mais por aqui.
});
