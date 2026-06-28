import { createHash, randomBytes } from "node:crypto";
import { accessTokenClaimsSchema } from "@mfp/shared";
import { jwtVerify, SignJWT } from "jose";
import type { Env } from "../config/env";
import { UnauthorizedError } from "../http/errors";
import { parseDurationMs } from "../utils/duration";
import type { AuthContext } from "./types";

/**
 * Access tokens are short-lived signed JWTs (HS256) carrying the tenant + role.
 * Refresh tokens are opaque random strings stored only as a SHA-256 hash, so a
 * database leak does not expose usable tokens; they are rotated on each use.
 */
export class TokenService {
  private readonly accessSecret: Uint8Array;

  constructor(private readonly env: Env) {
    this.accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  }

  async signAccessToken(ctx: AuthContext): Promise<string> {
    return new SignJWT({ tenantId: ctx.tenantId, role: ctx.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(ctx.userId)
      .setIssuedAt()
      .setExpirationTime(this.env.ACCESS_TOKEN_TTL)
      .sign(this.accessSecret);
  }

  async verifyAccessToken(token: string): Promise<AuthContext> {
    try {
      const { payload } = await jwtVerify(token, this.accessSecret);
      const claims = accessTokenClaimsSchema.parse({
        sub: payload.sub,
        tenantId: payload.tenantId,
        role: payload.role,
      });
      return {
        userId: claims.sub,
        tenantId: claims.tenantId,
        role: claims.role,
      };
    } catch {
      throw new UnauthorizedError("Invalid or expired access token");
    }
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString("base64url");
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  refreshTokenExpiry(): Date {
    return new Date(Date.now() + parseDurationMs(this.env.REFRESH_TOKEN_TTL));
  }
}
