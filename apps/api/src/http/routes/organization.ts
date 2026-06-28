import type { FastifyInstance } from "fastify";
import type { RouteDeps } from "./types";

export function organizationRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { services, guards } = deps;

  // The caller's tenant plus its members - backs the Members and Settings views.
  app.get("/organization", { preHandler: guards.requireAuth }, async (req) => {
    return services.auth.getOrganization(req.auth);
  });
}
