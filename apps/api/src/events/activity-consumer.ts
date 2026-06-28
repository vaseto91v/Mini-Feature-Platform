import type { ActivityType } from "@mfp/shared";
import type { UnitOfWork } from "../repositories/types";
import type { DomainEvent, EventHandler } from "./event-bus";

const ACTIVITY_TYPES = new Set<string>([
  "project.created",
  "task.created",
  "task.status_changed",
]);

/**
 * Projects domain events into the activity feed (a read model). Runs in a tenant
 * transaction so the write satisfies RLS for the event's tenant.
 */
export function createActivityConsumer(uow: UnitOfWork): EventHandler {
  return async (event: DomainEvent) => {
    if (!ACTIVITY_TYPES.has(event.type)) return;

    const projectId =
      typeof event.payload.projectId === "string" ? event.payload.projectId : null;
    const actorId =
      typeof event.payload.actorId === "string" ? event.payload.actorId : null;

    await uow.withTenant(event.tenantId, (repos) =>
      repos.activities.create({
        projectId,
        type: event.type as ActivityType,
        actorId,
        data: event.payload,
      }),
    );
  };
}
