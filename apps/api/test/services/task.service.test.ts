import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "../../src/http/errors";
import { buildTestContext, seedTenant, type TestContext } from "../helpers";

describe("TaskService", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = buildTestContext();
  });

  it("requires an existing project in the caller's tenant", async () => {
    const a = await seedTenant(ctx, "a@test.dev");
    const b = await seedTenant(ctx, "b@test.dev");
    const projectA = await ctx.services.projects.create(a.auth, { name: "A" });

    // Unknown project id.
    await expect(
      ctx.services.tasks.create(a.auth, "00000000-0000-0000-0000-000000000000", {
        title: "x",
        status: "todo",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    // Project belongs to another tenant.
    await expect(
      ctx.services.tasks.create(b.auth, projectA.id, {
        title: "x",
        status: "todo",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates a task and writes a task.created event", async () => {
    const { auth } = await seedTenant(ctx);
    const project = await ctx.services.projects.create(auth, { name: "A" });

    const task = await ctx.services.tasks.create(auth, project.id, {
      title: "Build it",
      status: "todo",
    });

    expect(task).toMatchObject({
      title: "Build it",
      status: "todo",
      projectId: project.id,
      tenantId: auth.tenantId,
    });
    const created = ctx.store.outbox.filter((e) => e.type === "task.created");
    expect(created).toHaveLength(1);
    expect(created[0]!.payload).toMatchObject({ taskId: task.id });
  });

  it("listAll returns every task across the tenant's projects; listByProject is scoped", async () => {
    const { auth } = await seedTenant(ctx);
    const p1 = await ctx.services.projects.create(auth, { name: "P1" });
    const p2 = await ctx.services.projects.create(auth, { name: "P2" });
    await ctx.services.tasks.create(auth, p1.id, { title: "t1", status: "todo" });
    await ctx.services.tasks.create(auth, p2.id, { title: "t2", status: "todo" });

    expect(await ctx.services.tasks.listAll(auth)).toHaveLength(2);
    expect(await ctx.services.tasks.listByProject(auth, p1.id)).toHaveLength(1);
  });

  it("updateStatus changes the status and emits only when it actually changes", async () => {
    const { auth } = await seedTenant(ctx);
    const project = await ctx.services.projects.create(auth, { name: "A" });
    const task = await ctx.services.tasks.create(auth, project.id, {
      title: "t",
      status: "todo",
    });

    const moved = await ctx.services.tasks.updateStatus(
      auth,
      task.id,
      "in_progress",
    );
    expect(moved.status).toBe("in_progress");
    expect(
      ctx.store.outbox.filter((e) => e.type === "task.status_changed"),
    ).toHaveLength(1);

    // No-op move to the same status emits no further event.
    await ctx.services.tasks.updateStatus(auth, task.id, "in_progress");
    expect(
      ctx.store.outbox.filter((e) => e.type === "task.status_changed"),
    ).toHaveLength(1);
  });

  it("updateStatus throws NotFound for unknown or cross-tenant tasks", async () => {
    const a = await seedTenant(ctx, "a@test.dev");
    const b = await seedTenant(ctx, "b@test.dev");
    const project = await ctx.services.projects.create(a.auth, { name: "A" });
    const task = await ctx.services.tasks.create(a.auth, project.id, {
      title: "t",
      status: "todo",
    });

    await expect(
      ctx.services.tasks.updateStatus(b.auth, task.id, "done"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("deletes a task and 404s when already gone", async () => {
    const { auth } = await seedTenant(ctx);
    const project = await ctx.services.projects.create(auth, { name: "A" });
    const task = await ctx.services.tasks.create(auth, project.id, {
      title: "t",
      status: "todo",
    });

    await ctx.services.tasks.delete(auth, task.id);
    expect(ctx.store.tasks.find((t) => t.id === task.id)).toBeUndefined();

    await expect(
      ctx.services.tasks.delete(auth, task.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
