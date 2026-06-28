import type { CreateProjectInput, Project } from "@mfp/shared";
import type { AuthContext } from "../auth/types";
import { NotFoundError } from "../http/errors";
import type { UnitOfWork } from "../repositories/types";

export class ProjectService {
  constructor(private readonly uow: UnitOfWork) {}

  create(ctx: AuthContext, input: CreateProjectInput): Promise<Project> {
    return this.uow.withTenant(ctx.tenantId, async (repos) => {
      const project = await repos.projects.create({ name: input.name });
      // Same transaction as the insert → the event can never be lost or orphaned.
      await repos.outbox.add({
        aggregateType: "project",
        aggregateId: project.id,
        type: "project.created",
        payload: {
          projectId: project.id,
          name: project.name,
          actorId: ctx.userId,
        },
      });
      return project;
    });
  }

  list(ctx: AuthContext): Promise<Project[]> {
    return this.uow.withTenant(ctx.tenantId, (repos) => repos.projects.list());
  }

  async getById(ctx: AuthContext, id: string): Promise<Project> {
    const project = await this.uow.withTenant(ctx.tenantId, (repos) =>
      repos.projects.findById(id),
    );
    if (!project) throw new NotFoundError("Project not found");
    return project;
  }

  delete(ctx: AuthContext, id: string): Promise<void> {
    return this.uow.withTenant(ctx.tenantId, async (repos) => {
      const deleted = await repos.projects.delete(id);
      if (!deleted) throw new NotFoundError("Project not found");
    });
  }
}
