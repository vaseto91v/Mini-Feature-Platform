import type { UserRole } from "@mfp/shared";
import type { FastifyRequest, preHandlerHookHandler } from "fastify";
import type { TokenService } from "../../auth/token.service";
import type { AuthContext } from "../../auth/types";
import { ForbiddenError, UnauthorizedError } from "../errors";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

export interface AuthGuards {
  /** Verifies the bearer access token and populates `req.auth`. */
  requireAuth: preHandlerHookHandler;
  /** Requires `req.auth.role` to be one of `roles` (run after requireAuth). */
  requireRole: (...roles: UserRole[]) => preHandlerHookHandler;
}

export function createAuthGuards(tokens: TokenService): AuthGuards {
  const requireAuth: preHandlerHookHandler = async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing bearer token");
    }
    req.auth = await tokens.verifyAccessToken(header.slice("Bearer ".length));
  };

  const requireRole =
    (...roles: UserRole[]): preHandlerHookHandler =>
    async (req: FastifyRequest) => {
      if (!req.auth || !roles.includes(req.auth.role)) {
        throw new ForbiddenError("Insufficient role");
      }
    };

  return { requireAuth, requireRole };
}
