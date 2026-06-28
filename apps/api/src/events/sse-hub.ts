import type { DomainEvent, EventHandler } from "./event-bus";

export interface SseClient {
  tenantId: string;
  projectId: string;
  send: (event: DomainEvent) => void;
}

/**
 * Tracks connected SSE clients and fans events out to the ones watching the
 * relevant tenant + project. Subscribe `handler` to the event bus.
 */
export class SseHub {
  private readonly clients = new Set<SseClient>();

  register(client: SseClient): () => void {
    this.clients.add(client);
    return () => this.clients.delete(client);
  }

  get clientCount(): number {
    return this.clients.size;
  }

  readonly handler: EventHandler = (event: DomainEvent) => {
    const projectId =
      typeof event.payload.projectId === "string" ? event.payload.projectId : null;
    if (!projectId) return;
    for (const client of this.clients) {
      if (client.tenantId === event.tenantId && client.projectId === projectId) {
        client.send(event);
      }
    }
  };
}
