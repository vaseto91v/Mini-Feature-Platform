/** A domain event as it flows through the bus (derived from an outbox row). */
export interface DomainEvent {
  id: string;
  tenantId: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type EventHandler = (event: DomainEvent) => void | Promise<void>;

/**
 * Minimal in-process pub/sub. In AWS this seam is where EventBridge/SQS would
 * slot in - the dispatcher and consumers stay the same, only the transport
 * changes. Each handler is isolated so one failure can't break the others.
 */
export class EventBus {
  private readonly handlers = new Set<EventHandler>();

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`Event handler failed for ${event.type}:`, err);
      }
    }
  }
}
