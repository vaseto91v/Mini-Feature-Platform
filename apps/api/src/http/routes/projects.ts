import { createProjectInputSchema, projectIdParamSchema } from "@mfp/shared";
import type { FastifyInstance } from "fastify";
import type { RouteDeps } from "./types";

export function projectRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { services, guards } = deps;

  app.post("/projects", { preHandler: guards.requireAuth }, async (req, reply) => {
    const input = createProjectInputSchema.parse(req.body);
    const project = await services.projects.create(req.auth, input);
    reply.code(201);
    return project;
  });

  app.get("/projects", { preHandler: guards.requireAuth }, async (req) => {
    return services.projects.list(req.auth);
  });

  app.delete(
    "/projects/:projectId",
    { preHandler: guards.requireAuth },
    async (req, reply) => {
      const { projectId } = projectIdParamSchema.parse(req.params);
      await services.projects.delete(req.auth, projectId);
      reply.code(204);
    },
  );
}
