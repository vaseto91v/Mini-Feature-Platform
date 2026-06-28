import type { AuthService } from "../auth/auth.service";
import { ActivityService } from "./activity.service";
import { ProjectService } from "./project.service";
import { TaskService } from "./task.service";

export { ProjectService } from "./project.service";
export { TaskService } from "./task.service";
export { ActivityService } from "./activity.service";

export interface AppServices {
  projects: ProjectService;
  tasks: TaskService;
  activities: ActivityService;
  auth: AuthService;
}
