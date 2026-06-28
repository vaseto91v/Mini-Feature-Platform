import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./common";

export const activityTypeSchema = z.enum([
  "project.created",
  "task.created",
  "task.status_changed",
]);
export type ActivityType = z.infer<typeof activityTypeSchema>;

/** An activity-feed entry as returned by the API. */
export const activitySchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  projectId: uuidSchema.nullable(),
  type: activityTypeSchema,
  actorId: uuidSchema.nullable(),
  /** Type-specific details, e.g. `{ from: "todo", to: "in_progress" }`. */
  data: z.record(z.string(), z.unknown()),
  createdAt: isoDateTimeSchema,
});
export type Activity = z.infer<typeof activitySchema>;
