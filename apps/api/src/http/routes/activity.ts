import { projectIdParamSchema } from "@mfp/shared";
import type { FastifyInstance } from "fastify";
import type { RouteDeps } from "./types";

export function activityRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { services, guards } = deps;

  app.get(
    "/projects/:projectId/activity",
    { preHandler: guards.requireAuth },
    async (req) => {
      const { projectId } = projectIdParamSchema.parse(req.params);
      return services.activities.listByProject(req.auth, projectId);
    },
  );

  // The live SSE stream (GET /projects/:projectId/stream) is added in Step 6.
}
