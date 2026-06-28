import { loginInputSchema, registerInputSchema } from "@mfp/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { parseDurationMs } from "../../utils/duration";
import { UnauthorizedError } from "../errors";
import type { RouteDeps } from "./types";

const REFRESH_COOKIE = "refresh_token";
// Scope the refresh cookie to the auth endpoints only.
const REFRESH_COOKIE_PATH = "/api/auth";

export function authRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const { services, guards, env } = deps;
  const auth = services.auth;

  const setRefreshCookie = (reply: FastifyReply, token: string): void => {
    reply.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: REFRESH_COOKIE_PATH,
      maxAge: Math.floor(parseDurationMs(env.REFRESH_TOKEN_TTL) / 1000),
    });
  };

  app.post("/auth/register", async (req, reply) => {
    const input = registerInputSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await auth.register(input);
    setRefreshCookie(reply, refreshToken);
    reply.code(201);
    return { user, accessToken };
  });

  app.post("/auth/login", async (req, reply) => {
    const input = loginInputSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await auth.login(input);
    setRefreshCookie(reply, refreshToken);
    return { user, accessToken };
  });

  app.post("/auth/refresh", async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedError("Missing refresh token");
    const { user, accessToken, refreshToken } = await auth.refresh(token);
    setRefreshCookie(reply, refreshToken);
    return { user, accessToken };
  });

  app.post("/auth/logout", async (req, reply) => {
    await auth.logout(req.cookies[REFRESH_COOKIE]);
    reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    return { success: true };
  });

  app.get("/auth/me", { preHandler: guards.requireAuth }, async (req) => {
    return auth.me(req.auth);
  });
}
