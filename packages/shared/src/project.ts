import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./common";

/** A Project as returned by the API. `tenantId` is the multi-tenancy partition key. */
export const projectSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  name: z.string().min(1).max(120),
  createdAt: isoDateTimeSchema,
});
export type Project = z.infer<typeof projectSchema>;

/** Body for `POST /projects`. */
export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

/** Path params for routes scoped to a single project. */
export const projectIdParamSchema = z.object({
  projectId: uuidSchema,
});
export type ProjectIdParam = z.infer<typeof projectIdParamSchema>;
