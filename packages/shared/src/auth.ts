import { z } from "zod";
import { userSchema } from "./user";

/**
 * `POST /auth/register` - creates a new tenant (the organization) and its first
 * user, who becomes the tenant owner.
 */
export const registerInputSchema = z.object({
  organizationName: z.string().trim().min(1, "Organization name is required").max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

/** `POST /auth/login`. */
export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * Response for register/login/refresh. The refresh token is delivered as an
 * httpOnly cookie (not in the body), so only the short-lived access token and
 * the user are returned here.
 */
export const authResponseSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** Decoded access-token claims used to build the per-request tenant context. */
export const accessTokenClaimsSchema = z.object({
  sub: z.string().uuid(), // userId
  tenantId: z.string().uuid(),
  role: z.enum(["owner", "admin", "member"]),
});
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;
