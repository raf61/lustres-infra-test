import { IEventPublisher, DomainEvent } from '../../domain/events/event-publisher';
import { getChatEventsQueue } from '../queue/chat-events.queue';

/**
 * Implementação do EventPublisher usando BullMQ.
 * Publica eventos na fila de chat-events para processamento assíncrono.
 */
export class BullMQEventPublisher implements IEventPublisher {
  async publish(event: DomainEvent): Promise<void> {
    const queue = getChatEventsQueue();
    
    await queue.add(event.type, {
      type: event.type,
      payload: event.payload,
      occurredAt: event.occurredAt || new Date(),
    }, {
      jobId: `${event.type}-${event.payload.conversationId || event.payload.id}-${Date.now()}`,
    });

    console.log(`[BullMQEventPublisher] Published: ${event.type}`);
  }
}

// Singleton para reutilização
let instance: BullMQEventPublisher | null = null;

export function getBullMQEventPublisher(): BullMQEventPublisher {
  if (!instance) {
    instance = new BullMQEventPublisher();
  }
  return instance;
}

