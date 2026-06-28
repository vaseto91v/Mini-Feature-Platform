import type {
  Activity,
  ActivityType,
  Project,
  Task,
  TaskStatus,
  User,
  UserRole,
} from "@mfp/shared";

// --- Internal entities not exposed in the public API contract ---

export interface TenantEntity {
  id: string;
  name: string;
  createdAt: string;
}

/** A user including the password hash - never returned by the API. */
export interface UserWithSecret extends User {
  passwordHash: string;
}

export interface RefreshTokenEntity {
  id: string;
  userId: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface OutboxEntry {
  id: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

// --- Tenant-scoped repositories (bound to a tenant transaction; RLS applies) ---

export interface ProjectRepository {
  create(data: { name: string }): Promise<Project>;
  list(): Promise<Project[]>;
  findById(id: string): Promise<Project | null>;
  /** Deletes the project (tasks/activities cascade). Returns false if not found. */
  delete(id: string): Promise<boolean>;
}

export interface TaskRepository {
  create(data: {
    projectId: string;
    title: string;
    status: TaskStatus;
  }): Promise<Task>;
  /** All tasks for the tenant across every project (newest first). */
  listAll(): Promise<Task[]>;
  listByProject(projectId: string): Promise<Task[]>;
  findById(id: string): Promise<Task | null>;
  updateStatus(id: string, status: TaskStatus): Promise<Task | null>;
  /** Deletes the task. Returns false if not found. */
  delete(id: string): Promise<boolean>;
}

export interface ActivityRepository {
  create(data: {
    projectId: string | null;
    type: ActivityType;
    actorId: string | null;
    data: Record<string, unknown>;
  }): Promise<Activity>;
  listByProject(projectId: string, limit?: number): Promise<Activity[]>;
}

/** Writes events to the outbox inside the same tenant transaction (atomic). */
export interface OutboxWriter {
  add(data: {
    aggregateType: string;
    aggregateId: string;
    type: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export interface TenantRepositories {
  projects: ProjectRepository;
  tasks: TaskRepository;
  activities: ActivityRepository;
  outbox: OutboxWriter;
}

// --- System repositories (cross-tenant; auth + the outbox relay) ---

export interface TenantRepository {
  create(data: { name: string }): Promise<TenantEntity>;
  findById(id: string): Promise<TenantEntity | null>;
}

export interface UserRepository {
  create(data: {
    tenantId: string;
    email: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<User>;
  findByEmail(email: string): Promise<UserWithSecret | null>;
  findById(id: string): Promise<UserWithSecret | null>;
  /** Public users belonging to a tenant (no password hash), newest first. */
  listByTenant(tenantId: string): Promise<User[]>;
}

export interface RefreshTokenRepository {
  create(data: {
    userId: string;
    tenantId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findActiveByHash(tokenHash: string): Promise<RefreshTokenEntity | null>;
  revokeById(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

/** Cross-tenant reader/processor for the relay. */
export interface OutboxRelayRepository {
  fetchUnprocessed(limit: number): Promise<OutboxEntry[]>;
  markProcessed(ids: string[]): Promise<void>;
}

export interface SystemRepositories {
  tenants: TenantRepository;
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  outboxRelay: OutboxRelayRepository;
}

// --- Unit of Work ---

export interface UnitOfWork {
  /** Runs `fn` in a tenant-scoped transaction (RLS enforced). */
  withTenant<T>(
    tenantId: string,
    fn: (repos: TenantRepositories) => Promise<T>,
  ): Promise<T>;
  /** Runs `fn` in a transaction with no tenant scope (auth / relay). */
  withSystem<T>(fn: (repos: SystemRepositories) => Promise<T>): Promise<T>;
}
