import { prisma } from "../../../lib/prisma";
import { getBullMQBroadcaster } from "../../../chat/infra/events/bullmq-broadcaster";
import type { IChatbotStatusEmitter, ChatbotStatusEvent } from "../../application/ports/chatbot-status-emitter";

export class BullMQChatbotStatusEmitter implements IChatbotStatusEmitter {
  private readonly broadcaster = getBullMQBroadcaster();

  async emitActive(input: ChatbotStatusEvent): Promise<void> {
    await this.emit({ ...input, active: true });
  }

  async emitInactive(input: ChatbotStatusEvent): Promise<void> {
    await this.emit({ ...input, active: false });
  }

  /**
   * Emite N eventos de "bot ativado" em 1 único round-trip Redis.
   * Se algum evento não tiver inboxId, resolve todos de uma vez (1 query DB em batch).
   */
  async bulkEmitActive(inputs: ChatbotStatusEvent[]): Promise<void> {
    if (inputs.length === 0) return;

    // Resolver inboxIds ausentes em batch (1 query para todos que precisam)
    const missingInbox = inputs.filter((i) => !i.inboxId).map((i) => i.conversationId);
    const inboxMap = new Map<string, string>();

    if (missingInbox.length > 0) {
      const records = await prisma.chatConversation.findMany({
        where: { id: { in: missingInbox } },
        select: { id: true, inboxId: true },
      });
      records.forEach((r) => inboxMap.set(r.id, r.inboxId));
    }

    // Montar os eventos já com inboxId resolvido
    const events = inputs.map((input) => ({
      type: "chatbot.session.active" as const,
      payload: {
        conversationId: input.conversationId,
        inboxId: input.inboxId ?? inboxMap.get(input.conversationId) ?? undefined,
        sessionId: input.sessionId ?? undefined,
        flowId: input.flowId ?? undefined,
        active: true,
        reason: input.reason,
      },
    }));

    // 1 único pipeline Redis para todos os N eventos
    await this.broadcaster.bulkBroadcast(events);
  }

  private async emit(input: ChatbotStatusEvent & { active: boolean }) {
    const inboxId = input.inboxId ?? (await this.resolveInboxId(input.conversationId));
    await this.broadcaster.broadcast({
      type: input.active ? "chatbot.session.active" : "chatbot.session.inactive",
      payload: {
        conversationId: input.conversationId,
        inboxId: inboxId ?? undefined,
        sessionId: input.sessionId ?? undefined,
        flowId: input.flowId ?? undefined,
        active: input.active,
        reason: input.reason,
      },
    });
  }

  private async resolveInboxId(conversationId: string): Promise<string | null> {
    const record = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { inboxId: true },
    });
    return record?.inboxId ?? null;
  }
}
