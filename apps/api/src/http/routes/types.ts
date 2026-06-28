import type { Env } from "../../config/env";
import type { TokenService } from "../../auth/token.service";
import type { SseHub } from "../../events/sse-hub";
import type { UnitOfWork } from "../../repositories/types";
import type { AppServices } from "../../services";
import type { AuthGuards } from "../plugins/auth";

/** Dependencies handed to each route module. */
export interface RouteDeps {
  services: AppServices;
  guards: AuthGuards;
  tokens: TokenService;
  sse: SseHub;
  uow: UnitOfWork;
  env: Env;
}
