import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./common";
import { userSchema } from "./user";

/**
 * `GET /organization` - the current tenant plus its members. Backs the
 * Members and Settings screens.
 */
export const organizationSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  createdAt: isoDateTimeSchema,
  members: z.array(userSchema),
});
export type Organization = z.infer<typeof organizationSchema>;
