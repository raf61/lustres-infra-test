/**
 * Interface para broadcasting de eventos real-time.
 * Usado para notificar frontends via WebSocket.
 * 
 * Diferente do IEventPublisher (que é para processamento assíncrono via filas),
 * o IBroadcaster é para notificações instantâneas (fire-and-forget).
 */

export type BroadcastEvent = {
  type: string;
  payload: Record<string, any>;
};

export interface IBroadcaster {
  /**
   * Publica um evento para todos os listeners (Socket.io servers).
   * Fire-and-forget - não espera confirmação.
   */
  broadcast(event: BroadcastEvent): Promise<void>;

  /**
   * Publica N eventos em um único pipeline Redis (addBulk).
   * Zero round-trips extras — 1 chamada para qualquer volume.
   */
  bulkBroadcast(events: BroadcastEvent[]): Promise<void>;
}

