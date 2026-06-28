import type {
  Activity,
  ActivityType,
  Project,
  Task,
  TaskStatus,
  User,
  UserRole,
} from "@mfp/shared";
import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { withSystem, withTenant, type Tx } from "../db/client";
import {
  activities,
  outbox,
  projects,
  refreshTokens,
  tasks,
  tenants,
  users,
  type ActivityRow,
  type OutboxRow,
  type ProjectRow,
  type RefreshTokenRow,
  type TaskRow,
  type TenantRow,
  type UserRow,
} from "../db/schema";
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

// --- Row → contract mappers ---

const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  tenantId: r.tenantId,
  name: r.name,
  createdAt: r.createdAt.toISOString(),
});

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  tenantId: r.tenantId,
  projectId: r.projectId,
  title: r.title,
  status: r.status as TaskStatus,
  createdAt: r.createdAt.toISOString(),
});

const toActivity = (r: ActivityRow): Activity => ({
  id: r.id,
  tenantId: r.tenantId,
  projectId: r.projectId,
  type: r.type as ActivityType,
  actorId: r.actorId,
  data: r.data,
  createdAt: r.createdAt.toISOString(),
});

const toUser = (r: UserRow): User => ({
  id: r.id,
  tenantId: r.tenantId,
  email: r.email,
  role: r.role as UserRole,
  createdAt: r.createdAt.toISOString(),
});

const toUserWithSecret = (r: UserRow): UserWithSecret => ({
  ...toUser(r),
  passwordHash: r.passwordHash,
});

const toTenant = (r: TenantRow): TenantEntity => ({
  id: r.id,
  name: r.name,
  createdAt: r.createdAt.toISOString(),
});

const toRefreshToken = (r: RefreshTokenRow): RefreshTokenEntity => ({
  id: r.id,
  userId: r.userId,
  tenantId: r.tenantId,
  tokenHash: r.tokenHash,
  expiresAt: r.expiresAt.toISOString(),
  createdAt: r.createdAt.toISOString(),
  revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
});

const toOutboxEntry = (r: OutboxRow): OutboxEntry => ({
  id: r.id,
  tenantId: r.tenantId,
  aggregateType: r.aggregateType,
  aggregateId: r.aggregateId,
  type: r.type,
  payload: r.payload,
  createdAt: r.createdAt.toISOString(),
});

// --- Tenant-scoped repositories ---
// Each query also filters by tenantId explicitly (app layer); RLS enforces the
// same at the database (defense-in-depth).

class PgProjectRepository implements ProjectRepository {
  constructor(
    private readonly tx: Tx,
    private readonly tenantId: string,
  ) {}

  async create(data: { name: string }): Promise<Project> {
    const [row] = await this.tx
      .insert(projects)
      .values({ tenantId: this.tenantId, name: data.name })
      .returning();
    return toProject(row!);
  }

  async list(): Promise<Project[]> {
    const rows = await this.tx
      .select()
      .from(projects)
      .where(eq(projects.tenantId, this.tenantId))
      .orderBy(desc(projects.createdAt));
    return rows.map(toProject);
  }

  async findById(id: string): Promise<Project | null> {
    const [row] = await this.tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, this.tenantId)));
    return row ? toProject(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    // Tasks and activities cascade via FK (onDelete: "cascade").
    const rows = await this.tx
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, this.tenantId)))
      .returning({ id: projects.id });
    return rows.length > 0;
  }
}

class PgTaskRepository implements TaskRepository {
  constructor(
    private readonly tx: Tx,
    private readonly tenantId: string,
  ) {}

  async create(data: {
    projectId: string;
    title: string;
    status: TaskStatus;
  }): Promise<Task> {
    const [row] = await this.tx
      .insert(tasks)
      .values({
        tenantId: this.tenantId,
        projectId: data.projectId,
        title: data.title,
        status: data.status,
      })
      .returning();
    return toTask(row!);
  }

  async listAll(): Promise<Task[]> {
    const rows = await this.tx
      .select()
      .from(tasks)
      .where(eq(tasks.tenantId, this.tenantId))
      .orderBy(desc(tasks.createdAt));
    return rows.map(toTask);
  }

  async listByProject(projectId: string): Promise<Task[]> {
    const rows = await this.tx
      .select()
      .from(tasks)
      .where(
        and(eq(tasks.tenantId, this.tenantId), eq(tasks.projectId, projectId)),
      )
      .orderBy(desc(tasks.createdAt));
    return rows.map(toTask);
  }

  async findById(id: string): Promise<Task | null> {
    const [row] = await this.tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, this.tenantId)));
    return row ? toTask(row) : null;
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task | null> {
    const [row] = await this.tx
      .update(tasks)
      .set({ status })
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, this.tenantId)))
      .returning();
    return row ? toTask(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.tx
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, this.tenantId)))
      .returning({ id: tasks.id });
    return rows.length > 0;
  }
}

class PgActivityRepository implements ActivityRepository {
  constructor(
    private readonly tx: Tx,
    private readonly tenantId: string,
  ) {}

  async create(data: {
    projectId: string | null;
    type: ActivityType;
    actorId: string | null;
    data: Record<string, unknown>;
  }): Promise<Activity> {
    const [row] = await this.tx
      .insert(activities)
      .values({
        tenantId: this.tenantId,
        projectId: data.projectId,
        type: data.type,
        actorId: data.actorId,
        data: data.data,
      })
      .returning();
    return toActivity(row!);
  }

  async listByProject(projectId: string, limit = 50): Promise<Activity[]> {
    const rows = await this.tx
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.tenantId, this.tenantId),
          eq(activities.projectId, projectId),
        ),
      )
      .orderBy(desc(activities.createdAt))
      .limit(limit);
    return rows.map(toActivity);
  }
}

class PgOutboxWriter implements OutboxWriter {
  constructor(
    private readonly tx: Tx,
    private readonly tenantId: string,
  ) {}

  async add(data: {
    aggregateType: string;
    aggregateId: string;
    type: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.tx.insert(outbox).values({
      tenantId: this.tenantId,
      aggregateType: data.aggregateType,
      aggregateId: data.aggregateId,
      type: data.type,
      payload: data.payload,
    });
  }
}

// --- System repositories ---

class PgTenantRepository implements TenantRepository {
  constructor(private readonly tx: Tx) {}

  async create(data: { name: string }): Promise<TenantEntity> {
    const [row] = await this.tx
      .insert(tenants)
      .values({ name: data.name })
      .returning();
    return toTenant(row!);
  }

  async findById(id: string): Promise<TenantEntity | null> {
    const [row] = await this.tx.select().from(tenants).where(eq(tenants.id, id));
    return row ? toTenant(row) : null;
  }
}

class PgUserRepository implements UserRepository {
  constructor(private readonly tx: Tx) {}

  async create(data: {
    tenantId: string;
    email: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<User> {
    const [row] = await this.tx.insert(users).values(data).returning();
    return toUser(row!);
  }

  async findByEmail(email: string): Promise<UserWithSecret | null> {
    const [row] = await this.tx
      .select()
      .from(users)
      .where(eq(users.email, email));
    return row ? toUserWithSecret(row) : null;
  }

  async findById(id: string): Promise<UserWithSecret | null> {
    const [row] = await this.tx.select().from(users).where(eq(users.id, id));
    return row ? toUserWithSecret(row) : null;
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    const rows = await this.tx
      .select()
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(desc(users.createdAt));
    return rows.map(toUser);
  }
}

class PgRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly tx: Tx) {}

  async create(data: {
    userId: string;
    tenantId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.tx.insert(refreshTokens).values(data);
  }

  async findActiveByHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    const [row] = await this.tx
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      );
    return row ? toRefreshToken(row) : null;
  }

  async revokeById(id: string): Promise<void> {
    await this.tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, id));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          isNull(refreshTokens.revokedAt),
        ),
      );
  }
}

class PgOutboxRelay implements OutboxRelayRepository {
  constructor(private readonly tx: Tx) {}

  async fetchUnprocessed(limit: number): Promise<OutboxEntry[]> {
    // FOR UPDATE SKIP LOCKED lets multiple relay workers drain safely.
    const rows = await this.tx
      .select()
      .from(outbox)
      .where(isNull(outbox.processedAt))
      .orderBy(asc(outbox.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    return rows.map(toOutboxEntry);
  }

  async markProcessed(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.tx
      .update(outbox)
      .set({ processedAt: new Date() })
      .where(inArray(outbox.id, ids));
  }
}

// --- Unit of Work ---

export class PgUnitOfWork implements UnitOfWork {
  withTenant<T>(
    tenantId: string,
    fn: (repos: TenantRepositories) => Promise<T>,
  ): Promise<T> {
    return withTenant(tenantId, (tx) =>
      fn({
        projects: new PgProjectRepository(tx, tenantId),
        tasks: new PgTaskRepository(tx, tenantId),
        activities: new PgActivityRepository(tx, tenantId),
        outbox: new PgOutboxWriter(tx, tenantId),
      }),
    );
  }

  withSystem<T>(fn: (repos: SystemRepositories) => Promise<T>): Promise<T> {
    return withSystem((tx) =>
      fn({
        tenants: new PgTenantRepository(tx),
        users: new PgUserRepository(tx),
        refreshTokens: new PgRefreshTokenRepository(tx),
        outboxRelay: new PgOutboxRelay(tx),
      }),
    );
  }
}
