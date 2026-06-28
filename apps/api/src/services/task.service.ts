import type { CreateTaskInput, Task, TaskStatus } from "@mfp/shared";
import type { AuthContext } from "../auth/types";
import { NotFoundError } from "../http/errors";
import type { UnitOfWork } from "../repositories/types";

export class TaskService {
  constructor(private readonly uow: UnitOfWork) {}

  create(
    ctx: AuthContext,
    projectId: string,
    input: CreateTaskInput,
  ): Promise<Task> {
    return this.uow.withTenant(ctx.tenantId, async (repos) => {
      const project = await repos.projects.findById(projectId);
      if (!project) throw new NotFoundError("Project not found");

      const task = await repos.tasks.create({
        projectId,
        title: input.title,
        status: input.status,
      });
      await repos.outbox.add({
        aggregateType: "task",
        aggregateId: task.id,
        type: "task.created",
        payload: {
          taskId: task.id,
          projectId,
          title: task.title,
          status: task.status,
          actorId: ctx.userId,
        },
      });
      return task;
    });
  }

  /** Every task across the tenant's projects - backs the "My issues" view. */
  listAll(ctx: AuthContext): Promise<Task[]> {
    return this.uow.withTenant(ctx.tenantId, (repos) => repos.tasks.listAll());
  }

  listByProject(ctx: AuthContext, projectId: string): Promise<Task[]> {
    return this.uow.withTenant(ctx.tenantId, async (repos) => {
      const project = await repos.projects.findById(projectId);
      if (!project) throw new NotFoundError("Project not found");
      return repos.tasks.listByProject(projectId);
    });
  }

  updateStatus(
    ctx: AuthContext,
    taskId: string,
    status: TaskStatus,
  ): Promise<Task> {
    return this.uow.withTenant(ctx.tenantId, async (repos) => {
      const existing = await repos.tasks.findById(taskId);
      if (!existing) throw new NotFoundError("Task not found");

      const updated = await repos.tasks.updateStatus(taskId, status);
      if (!updated) throw new NotFoundError("Task not found");

      // Only emit when the status actually changed.
      if (existing.status !== status) {
        await repos.outbox.add({
          aggregateType: "task",
          aggregateId: taskId,
          type: "task.status_changed",
          payload: {
            taskId,
            projectId: existing.projectId,
            from: existing.status,
            to: status,
            actorId: ctx.userId,
          },
        });
      }
      return updated;
    });
  }

  delete(ctx: AuthContext, taskId: string): Promise<void> {
    return this.uow.withTenant(ctx.tenantId, async (repos) => {
      const deleted = await repos.tasks.delete(taskId);
      if (!deleted) throw new NotFoundError("Task not found");
    });
  }
}
