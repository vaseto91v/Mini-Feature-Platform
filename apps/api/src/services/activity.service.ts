import type { Activity } from "@mfp/shared";
import type { AuthContext } from "../auth/types";
import { NotFoundError } from "../http/errors";
import type { UnitOfWork } from "../repositories/types";

export class ActivityService {
  constructor(private readonly uow: UnitOfWork) {}

  listByProject(ctx: AuthContext, projectId: string): Promise<Activity[]> {
    return this.uow.withTenant(ctx.tenantId, async (repos) => {
      const project = await repos.projects.findById(projectId);
      if (!project) throw new NotFoundError("Project not found");
      return repos.activities.listByProject(projectId);
    });
  }
}
