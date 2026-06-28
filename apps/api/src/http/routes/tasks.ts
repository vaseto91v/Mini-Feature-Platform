import {
  createTaskInputSchema,
  projectIdParamSchema,
  taskIdParamSchema,
  updateTaskStatusInputSchema,
} from "@mfp/shared";
import type { FastifyInstance } from "fastify";
import type { RouteDeps } from "./types";

export function taskRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { services, guards } = deps;

  // All of the tenant's tasks across every project (the "My issues" view).
  app.get("/tasks", { preHandler: guards.requireAuth }, async (req) => {
    return services.tasks.listAll(req.auth);
  });

  app.post(
    "/projects/:projectId/tasks",
    { preHandler: guards.requireAuth },
    async (req, reply) => {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const input = createTaskInputSchema.parse(req.body);
      const task = await services.tasks.create(req.auth, projectId, input);
      reply.code(201);
      return task;
    },
  );

  app.get(
    "/projects/:projectId/tasks",
    { preHandler: guards.requireAuth },
    async (req) => {
      const { projectId } = projectIdParamSchema.parse(req.params);
      return services.tasks.listByProject(req.auth, projectId);
    },
  );

  app.patch(
    "/tasks/:taskId/status",
    { preHandler: guards.requireAuth },
    async (req) => {
      const { taskId } = taskIdParamSchema.parse(req.params);
      const { status } = updateTaskStatusInputSchema.parse(req.body);
      return services.tasks.updateStatus(req.auth, taskId, status);
    },
  );

  app.delete(
    "/tasks/:taskId",
    { preHandler: guards.requireAuth },
    async (req, reply) => {
      const { taskId } = taskIdParamSchema.parse(req.params);
      await services.tasks.delete(req.auth, taskId);
      reply.code(204);
    },
  );
}
