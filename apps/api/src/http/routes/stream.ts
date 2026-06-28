import { projectIdParamSchema } from "@mfp/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RouteDeps } from "./types";

// EventSource can't set Authorization headers, so the access token is passed as
// a query param and verified here. (Trade-off: tokens can appear in logs; for a
// production system I'd use a short-lived stream ticket instead.)
const streamQuerySchema = z.object({ token: z.string().min(1) });

export function streamRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { services, tokens, sse, env } = deps;

  app.get("/projects/:projectId/stream", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { token } = streamQuerySchema.parse(req.query);
    const auth = await tokens.verifyAccessToken(token);
    // 404s if the project isn't in this tenant.
    await services.projects.getById(auth, projectId);

    reply.hijack();
    const raw = reply.raw;
    // hijack bypasses Fastify's header pipeline, so set CORS + SSE headers here.
    raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": env.CORS_ORIGIN,
    });
    raw.write(": connected\n\n");

    const unregister = sse.register({
      tenantId: auth.tenantId,
      projectId,
      send: (event) => {
        raw.write(`event: ${event.type}\n`);
        raw.write(`data: ${JSON.stringify(event)}\n\n`);
      },
    });

    const heartbeat = setInterval(() => raw.write(": ping\n\n"), 25_000);
    heartbeat.unref?.();

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unregister();
    });
  });
}
