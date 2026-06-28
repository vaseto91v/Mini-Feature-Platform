import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./common";

/** Role within a tenant. Enforced by route guards. */
export const userRoleSchema = z.enum(["owner", "admin", "member"]);
export type UserRole = z.infer<typeof userRoleSchema>;

/**
 * Public user shape - what the API returns. Never includes the password hash.
 */
export const userSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  email: z.string().email(),
  role: userRoleSchema,
  createdAt: isoDateTimeSchema,
});
export type User = z.infer<typeof userSchema>;
