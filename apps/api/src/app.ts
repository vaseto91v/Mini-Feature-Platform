import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { TokenService } from "./auth/token.service";
import type { Env } from "./config/env";
import type { OutboxDispatcher } from "./events/dispatcher";
import type { SseHub } from "./events/sse-hub";
import { AppError } from "./http/errors";
import { createAuthGuards } from "./http/plugins/auth";
import { activityRoutes } from "./http/routes/activity";
import { authRoutes } from "./http/routes/auth";
import { healthRoutes } from "./http/routes/health";
import { organizationRoutes } from "./http/routes/organization";
import { projectRoutes } from "./http/routes/projects";
import { streamRoutes } from "./http/routes/stream";
import { taskRoutes } from "./http/routes/tasks";
import type { RouteDeps } from "./http/routes/types";
import type { UnitOfWork } from "./repositories/types";
import type { AppServices } from "./services";

export interface AppDeps {
  env: Env;
  uow: UnitOfWork;
  services: AppServices;
  tokens: TokenService;
  sse: SseHub;
  dispatcher: OutboxDispatcher;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: deps.env.NODE_ENV !== "test",
  });

  // @fastify/cors v11 defaults `methods` to the CORS "simple" set (GET,HEAD,POST),
  // which makes the browser preflight reject PATCH/DELETE. List them explicitly
  // so task-status moves (PATCH) and deletes (DELETE) pass preflight.
  app.register(cors, {
    origin: deps.env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"],
  });
  app.register(cookie);

  const routeDeps: RouteDeps = {
    services: deps.services,
    guards: createAuthGuards(deps.tokens),
    tokens: deps.tokens,
    sse: deps.sse,
    uow: deps.uow,
    env: deps.env,
  };

  // Health at root (load balancer probe); domain routes under /api.
  healthRoutes(app);
  app.register(
    async (api) => {
      authRoutes(api, routeDeps);
      projectRoutes(api, routeDeps);
      taskRoutes(api, routeDeps);
      activityRoutes(api, routeDeps);
      streamRoutes(api, routeDeps);
      organizationRoutes(api, routeDeps);
    },
    { prefix: "/api" },
  );

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({
        error: { message: error.message, code: error.code, details: error.details },
      });
      return;
    }
    if (error instanceof ZodError) {
      reply.code(400).send({
        error: {
          message: "Validation failed",
          code: "validation_error",
          details: error.flatten(),
        },
      });
      return;
    }
    // Fastify's own errors (validation, content-type, etc.) carry a 4xx status.
    const fastifyError = error as {
      statusCode?: number;
      code?: string;
      message?: string;
    };
    if (
      typeof fastifyError.statusCode === "number" &&
      fastifyError.statusCode >= 400 &&
      fastifyError.statusCode < 500
    ) {
      reply.code(fastifyError.statusCode).send({
        error: {
          message: fastifyError.message ?? "Bad request",
          code: fastifyError.code ?? "bad_request",
        },
      });
      return;
    }
    req.log.error(error);
    reply.code(500).send({
      error: { message: "Internal server error", code: "internal_error" },
    });
  });

  return app;
}
