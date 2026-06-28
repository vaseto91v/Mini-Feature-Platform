import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./common";

/** Task lifecycle states (the Kanban columns). */
export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/** Ordered list of statuses - handy for rendering board columns in order. */
export const TASK_STATUSES = taskStatusSchema.options;

/** A Task as returned by the API. */
export const taskSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  projectId: uuidSchema,
  title: z.string().min(1).max(200),
  status: taskStatusSchema,
  createdAt: isoDateTimeSchema,
});
export type Task = z.infer<typeof taskSchema>;

/** Body for `POST /projects/:projectId/tasks` (projectId comes from the path). */
export const createTaskInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  status: taskStatusSchema.default("todo"),
});
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

/** Body for `PATCH /tasks/:taskId/status`. */
export const updateTaskStatusInputSchema = z.object({
  status: taskStatusSchema,
});
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusInputSchema>;

/** Path params for routes scoped to a single task. */
export const taskIdParamSchema = z.object({
  taskId: uuidSchema,
});
export type TaskIdParam = z.infer<typeof taskIdParamSchema>;
