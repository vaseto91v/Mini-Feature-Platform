import type { UnitOfWork } from "../repositories/types";
import type { OutboxEntry } from "../repositories/types";
import type { DomainEvent, EventBus } from "./event-bus";

const toDomainEvent = (e: OutboxEntry): DomainEvent => ({
  id: e.id,
  tenantId: e.tenantId,
  type: e.type,
  aggregateType: e.aggregateType,
  aggregateId: e.aggregateId,
  payload: e.payload,
  createdAt: e.createdAt,
});

export interface DispatcherOptions {
  intervalMs?: number;
  batchSize?: number;
}

/**
 * Polls the transactional outbox and republishes new events onto the bus.
 *
 * Fetch + mark-processed happen in one transaction (the repo uses
 * FOR UPDATE SKIP LOCKED), so multiple dispatcher instances could run safely.
 * A production system would swap polling for LISTEN/NOTIFY or a real queue with
 * per-consumer retries + DLQ; the outbox guarantees at-least-once hand-off.
 */
export class OutboxDispatcher {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly intervalMs: number;
  private readonly batchSize: number;

  constructor(
    private readonly uow: UnitOfWork,
    private readonly bus: EventBus,
    options: DispatcherOptions = {},
  ) {
    this.intervalMs = options.intervalMs ?? 1000;
    this.batchSize = options.batchSize ?? 50;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Drains one batch. Exposed so tests can pump the outbox deterministically. */
  async tick(): Promise<number> {
    if (this.running) return 0; // avoid overlapping ticks
    this.running = true;
    try {
      return await this.uow.withSystem(async (repos) => {
        const entries = await repos.outboxRelay.fetchUnprocessed(this.batchSize);
        if (entries.length === 0) return 0;
        for (const entry of entries) {
          await this.bus.publish(toDomainEvent(entry));
        }
        await repos.outboxRelay.markProcessed(entries.map((e) => e.id));
        return entries.length;
      });
    } catch (err) {
      console.error("Outbox dispatch failed:", err);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
