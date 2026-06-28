import { AuthService } from "./auth/auth.service";
import { PasswordService } from "./auth/password.service";
import { TokenService } from "./auth/token.service";
import { env } from "./config/env";
import { createActivityConsumer } from "./events/activity-consumer";
import { OutboxDispatcher } from "./events/dispatcher";
import { EventBus } from "./events/event-bus";
import { SseHub } from "./events/sse-hub";
import { PgUnitOfWork } from "./repositories";
import type { UnitOfWork } from "./repositories/types";
import {
  ActivityService,
  ProjectService,
  TaskService,
  type AppServices,
} from "./services";
import type { AppDeps } from "./app";

/**
 * Composition root. Wires the Postgres unit of work into the services and
 * builds the dependency bundle the app is constructed from. Swapping in a
 * MemoryUnitOfWork here (or in tests) requires no changes elsewhere.
 */
export function buildContainer(): AppDeps {
  const uow: UnitOfWork = new PgUnitOfWork();
  const tokens = new TokenService(env);
  const passwords = new PasswordService();
  const services: AppServices = {
    projects: new ProjectService(uow),
    tasks: new TaskService(uow),
    activities: new ActivityService(uow),
    auth: new AuthService(uow, tokens, passwords),
  };

  // Event backbone: outbox → dispatcher → bus → { activity writer, SSE hub }.
  const bus = new EventBus();
  const sse = new SseHub();
  bus.subscribe(createActivityConsumer(uow));
  bus.subscribe(sse.handler);
  const dispatcher = new OutboxDispatcher(uow, bus);

  return { env, uow, services, tokens, sse, dispatcher };
}
