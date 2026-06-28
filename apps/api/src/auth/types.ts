import type { UserRole } from "@mfp/shared";

/** The authenticated principal for a request, derived from the access token. */
export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
}
