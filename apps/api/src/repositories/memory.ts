import { randomUUID } from "node:crypto";
import type { Activity, ActivityType, Project, Task, TaskStatus, User, UserRole } from "@mfp/shared";
import type {
  ActivityRepository,
  OutboxEntry,
  OutboxRelayRepository,
  OutboxWriter,
  ProjectRepository,
  RefreshTokenEntity,
  RefreshTokenRepository,
  SystemRepositories,
  TaskRepository,
  TenantEntity,
  TenantRepositories,
  TenantRepository,
  UnitOfWork,
  UserRepository,
  UserWithSecret,
} from "./types";

interface MemoryOutboxRow extends OutboxEntry {
  processedAt: string | null;
}

/** In-memory data store shared by all repositories in a MemoryUnitOfWork. */
export class MemoryStore {
  tenants: TenantEntity[] = [];
  users: UserWithSecret[] = [];
  refreshTokens: RefreshTokenEntity[] = [];
  projects: Project[] = [];
  tasks: Task[] = [];
  activities: Activity[] = [];
  outbox: MemoryOutboxRow[] = [];
}

const now = (): string => new Date().toISOString();
const byCreatedAtDesc = <T extends { createdAt: string }>(a: T, b: T): number =>
  b.createdAt.localeCompare(a.createdAt);

// Reads return snapshots (not live references), so callers can't accidentally
// mutate the store - matching how the Postgres repo maps each row afresh.
const clone = <T>(value: T): T => ({ ...value });
const cloneAll = <T>(values: T[]): T[] => values.map(clone);

// --- Tenant-scoped repositories ---

class MemProjectRepository implements ProjectRepository {
  constructor(
    private readonly store: MemoryStore,
    private readonly tenantId: string,
  ) {}

  async create(data: { name: string }): Promise<Project> {
    const project: Project = {
      id: randomUUID(),
      tenantId: this.tenantId,
      name: data.name,
      createdAt: now(),
    };
    this.store.projects.push(project);
    return project;
  }

  async list(): Promise<Project[]> {
    return cloneAll(
      this.store.projects
        .filter((p) => p.tenantId === this.tenantId)
        .sort(byCreatedAtDesc),
    );
  }

  async findById(id: string): Promise<Project | null> {
    const row = this.store.projects.find(
      (p) => p.id === id && p.tenantId === this.tenantId,
    );
    return row ? clone(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.store.projects.findIndex(
      (p) => p.id === id && p.tenantId === this.tenantId,
    );
    if (idx === -1) return false;
    this.store.projects.splice(idx, 1);
    // Mirror the DB's cascade: drop this project's tasks and activities.
    this.store.tasks = this.store.tasks.filter((t) => t.projectId !== id);
    this.store.activities = this.store.activities.filter(
      (a) => a.projectId !== id,
    );
    return true;
  }
}

class MemTaskRepository implements TaskRepository {
  constructor(
    private readonly store: MemoryStore,
    private readonly tenantId: string,
  ) {}

  async create(data: {
    projectId: string;
    title: string;
    status: TaskStatus;
  }): Promise<Task> {
    const task: Task = {
      id: randomUUID(),
      tenantId: this.tenantId,
      projectId: data.projectId,
      title: data.title,
      status: data.status,
      createdAt: now(),
    };
    this.store.tasks.push(task);
    return task;
  }

  async listAll(): Promise<Task[]> {
    return cloneAll(
      this.store.tasks
        .filter((t) => t.tenantId === this.tenantId)
        .sort(byCreatedAtDesc),
    );
  }

  async listByProject(projectId: string): Promise<Task[]> {
    return cloneAll(
      this.store.tasks
        .filter((t) => t.tenantId === this.tenantId && t.projectId === projectId)
        .sort(byCreatedAtDesc),
    );
  }

  async findById(id: string): Promise<Task | null> {
    const row = this.store.tasks.find(
      (t) => t.id === id && t.tenantId === this.tenantId,
    );
    return row ? clone(row) : null;
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task | null> {
    const task = this.store.tasks.find(
      (t) => t.id === id && t.tenantId === this.tenantId,
    );
    if (!task) return null;
    task.status = status;
    return clone(task);
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.store.tasks.findIndex(
      (t) => t.id === id && t.tenantId === this.tenantId,
    );
    if (idx === -1) return false;
    this.store.tasks.splice(idx, 1);
    return true;
  }
}

class MemActivityRepository implements ActivityRepository {
  constructor(
    private readonly store: MemoryStore,
    private readonly tenantId: string,
  ) {}

  async create(data: {
    projectId: string | null;
    type: ActivityType;
    actorId: string | null;
    data: Record<string, unknown>;
  }): Promise<Activity> {
    const activity: Activity = {
      id: randomUUID(),
      tenantId: this.tenantId,
      projectId: data.projectId,
      type: data.type,
      actorId: data.actorId,
      data: data.data,
      createdAt: now(),
    };
    this.store.activities.push(activity);
    return activity;
  }

  async listByProject(projectId: string, limit = 50): Promise<Activity[]> {
    return cloneAll(
      this.store.activities
        .filter((a) => a.tenantId === this.tenantId && a.projectId === projectId)
        .sort(byCreatedAtDesc)
        .slice(0, limit),
    );
  }
}

class MemOutboxWriter implements OutboxWriter {
  constructor(
    private readonly store: MemoryStore,
    private readonly tenantId: string,
  ) {}

  async add(data: {
    aggregateType: string;
    aggregateId: string;
    type: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    this.store.outbox.push({
      id: randomUUID(),
      tenantId: this.tenantId,
      aggregateType: data.aggregateType,
      aggregateId: data.aggregateId,
      type: data.type,
      payload: data.payload,
      createdAt: now(),
      processedAt: null,
    });
  }
}

// --- System repositories ---

class MemTenantRepository implements TenantRepository {
  constructor(private readonly store: MemoryStore) {}

  async create(data: { name: string }): Promise<TenantEntity> {
    const tenant: TenantEntity = {
      id: randomUUID(),
      name: data.name,
      createdAt: now(),
    };
    this.store.tenants.push(tenant);
    return tenant;
  }

  async findById(id: string): Promise<TenantEntity | null> {
    const row = this.store.tenants.find((t) => t.id === id);
    return row ? clone(row) : null;
  }
}

class MemUserRepository implements UserRepository {
  constructor(private readonly store: MemoryStore) {}

  async create(data: {
    tenantId: string;
    email: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<User> {
    const user: UserWithSecret = {
      id: randomUUID(),
      tenantId: data.tenantId,
      email: data.email,
      role: data.role,
      passwordHash: data.passwordHash,
      createdAt: now(),
    };
    this.store.users.push(user);
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  }

  async findByEmail(email: string): Promise<UserWithSecret | null> {
    const row = this.store.users.find((u) => u.email === email);
    return row ? clone(row) : null;
  }

  async findById(id: string): Promise<UserWithSecret | null> {
    const row = this.store.users.find((u) => u.id === id);
    return row ? clone(row) : null;
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    return this.store.users
      .filter((u) => u.tenantId === tenantId)
      .sort(byCreatedAtDesc)
      .map(({ passwordHash: _hash, ...user }) => user);
  }
}

class MemRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly store: MemoryStore) {}

  async create(data: {
    userId: string;
    tenantId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    this.store.refreshTokens.push({
      id: randomUUID(),
      userId: data.userId,
      tenantId: data.tenantId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt.toISOString(),
      createdAt: now(),
      revokedAt: null,
    });
  }

  async findActiveByHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    const token = this.store.refreshTokens.find(
      (t) =>
        t.tokenHash === tokenHash &&
        t.revokedAt === null &&
        new Date(t.expiresAt) > new Date(),
    );
    return token ?? null;
  }

  async revokeById(id: string): Promise<void> {
    const token = this.store.refreshTokens.find((t) => t.id === id);
    if (token) token.revokedAt = now();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const token of this.store.refreshTokens) {
      if (token.userId === userId && token.revokedAt === null) {
        token.revokedAt = now();
      }
    }
  }
}

class MemOutboxRelay implements OutboxRelayRepository {
  constructor(private readonly store: MemoryStore) {}

  async fetchUnprocessed(limit: number): Promise<OutboxEntry[]> {
    return this.store.outbox
      .filter((o) => o.processedAt === null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit)
      .map(({ processedAt: _processedAt, ...entry }) => entry);
  }

  async markProcessed(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    for (const row of this.store.outbox) {
      if (idSet.has(row.id)) row.processedAt = now();
    }
  }
}

// --- Unit of Work ---

export class MemoryUnitOfWork implements UnitOfWork {
  constructor(private readonly store: MemoryStore = new MemoryStore()) {}

  withTenant<T>(
    tenantId: string,
    fn: (repos: TenantRepositories) => Promise<T>,
  ): Promise<T> {
    return fn({
      projects: new MemProjectRepository(this.store, tenantId),
      tasks: new MemTaskRepository(this.store, tenantId),
      activities: new MemActivityRepository(this.store, tenantId),
      outbox: new MemOutboxWriter(this.store, tenantId),
    });
  }

  withSystem<T>(fn: (repos: SystemRepositories) => Promise<T>): Promise<T> {
    return fn({
      tenants: new MemTenantRepository(this.store),
      users: new MemUserRepository(this.store),
      refreshTokens: new MemRefreshTokenRepository(this.store),
      outboxRelay: new MemOutboxRelay(this.store),
    });
  }
}
