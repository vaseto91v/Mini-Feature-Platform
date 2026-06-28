import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AuthService } from "../src/auth/auth.service";
import { PasswordService } from "../src/auth/password.service";
import { TokenService } from "../src/auth/token.service";
import type { AuthContext } from "../src/auth/types";
import { buildApp, type AppDeps } from "../src/app";
import { env } from "../src/config/env";
import { createActivityConsumer } from "../src/events/activity-consumer";
import { OutboxDispatcher } from "../src/events/dispatcher";
import { EventBus } from "../src/events/event-bus";
import { SseHub } from "../src/events/sse-hub";
import { MemoryStore, MemoryUnitOfWork } from "../src/repositories/memory";
import {
  ActivityService,
  ProjectService,
  TaskService,
  type AppServices,
} from "../src/services";

export interface TestContext {
  app: FastifyInstance;
  deps: AppDeps;
  store: MemoryStore;
  uow: MemoryUnitOfWork;
  dispatcher: OutboxDispatcher;
  services: AppServices;
}

/**
 * Builds the full app wired to the in-memory unit of work - the same
 * composition as the real container, minus Postgres. The dispatcher is created
 * but not started; tests pump it with `dispatcher.tick()` for determinism.
 */
export function buildTestContext(): TestContext {
  const store = new MemoryStore();
  const uow = new MemoryUnitOfWork(store);
  const tokens = new TokenService(env);
  const passwords = new PasswordService();
  const services: AppServices = {
    projects: new ProjectService(uow),
    tasks: new TaskService(uow),
    activities: new ActivityService(uow),
    auth: new AuthService(uow, tokens, passwords),
  };

  const bus = new EventBus();
  const sse = new SseHub();
  bus.subscribe(createActivityConsumer(uow));
  bus.subscribe(sse.handler);
  const dispatcher = new OutboxDispatcher(uow, bus);

  const deps: AppDeps = { env, uow, services, tokens, sse, dispatcher };
  const app = buildApp(deps);
  return { app, deps, store, uow, dispatcher, services };
}

export interface SeededTenant {
  auth: AuthContext;
  userId: string;
  tenantId: string;
  refreshToken: string;
  accessToken: string;
}

/** Registers an organization + owner directly via the service layer. */
export async function seedTenant(
  ctx: TestContext,
  email = `user_${randomUUID()}@test.dev`,
): Promise<SeededTenant> {
  const { user, accessToken, refreshToken } = await ctx.services.auth.register({
    organizationName: "Acme",
    email,
    password: "supersecret123",
  });
  return {
    auth: { userId: user.id, tenantId: user.tenantId, role: user.role },
    userId: user.id,
    tenantId: user.tenantId,
    accessToken,
    refreshToken,
  };
}

export interface ApiUser {
  token: string;
  user: { id: string; tenantId: string; email: string; role: string };
  cookie: string | undefined;
}

/** Registers via the HTTP API (POST /api/auth/register) and returns the token. */
export async function registerViaApi(
  app: FastifyInstance,
  overrides: { organizationName?: string; email?: string; password?: string } = {},
): Promise<ApiUser> {
  const payload = {
    organizationName: overrides.organizationName ?? "Acme",
    email: overrides.email ?? `user_${randomUUID()}@test.dev`,
    password: overrides.password ?? "supersecret123",
  };
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload,
  });
  const body = res.json();
  const setCookie = res.headers["set-cookie"];
  return {
    token: body.accessToken,
    user: body.user,
    cookie: Array.isArray(setCookie) ? setCookie[0] : setCookie,
  };
}

/** Authorization header for an access token. */
export const bearer = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
});
