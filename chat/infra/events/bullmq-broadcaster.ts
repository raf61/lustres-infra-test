import { IBroadcaster, BroadcastEvent } from '../../domain/events/broadcaster';
import { getBroadcastsQueue } from '../queue/broadcasts.queue';

/**
 * Implementação do Broadcaster usando BullMQ.
 * Adiciona jobs na fila chat-broadcasts para o Socket.io server consumir.
 */
export class BullMQBroadcaster implements IBroadcaster {
  async broadcast(event: BroadcastEvent): Promise<void> {
    const queue = getBroadcastsQueue();
    const timestamp = new Date().toISOString();

    await queue.add(event.type, {
      type: event.type as any,
      payload: event.payload,
      timestamp,
    }, {
      jobId: `${event.type}-${event.payload.conversationId || event.payload.id}-${Date.now()}`,
    });

    console.log(`[BullMQBroadcaster] Queued: ${event.type}`);
  }

  /**
   * Enfileira N eventos em um único pipeline Redis (1 round-trip, qualquer volume).
   * Usa queue.addBulk() do BullMQ internamente.
   */
  async bulkBroadcast(events: BroadcastEvent[]): Promise<void> {
    if (events.length === 0) return;
    const queue = getBroadcastsQueue();
    const timestamp = new Date().toISOString();

    await queue.addBulk(
      events.map((event) => ({
        name: event.type,
        data: {
          type: event.type as any,
          payload: event.payload,
          timestamp,
        },
        opts: {
          // jobId único por conversa+tipo — sem duplicatas
          jobId: `${event.type}-${event.payload.conversationId || event.payload.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
      }))
    );

    console.log(`[BullMQBroadcaster] Bulk queued: ${events.length} events`);
  }
}

// Singleton
let instance: BullMQBroadcaster | null = null;

export function getBullMQBroadcaster(): BullMQBroadcaster {
  if (!instance) {
    instance = new BullMQBroadcaster();
  }
  return instance;
}

