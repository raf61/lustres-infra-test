/**
 * Interface abstrata para publicação de eventos de domínio.
 * O UseCase conhece apenas esta interface, não a implementação (fila, pubsub, etc).
 */

export type DomainEvent = {
  type: string;
  payload: Record<string, any>;
  occurredAt?: Date;
};

export interface IEventPublisher {
  /**
   * Publica um evento de domínio.
   * A implementação decide como persistir/transmitir (fila, pubsub, etc).
   */
  publish(event: DomainEvent): Promise<void>;
}

