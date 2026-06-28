import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "../../src/http/errors";
import { buildTestContext, seedTenant, type TestContext } from "../helpers";

describe("ProjectService", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = buildTestContext();
  });

  it("creates a project and writes a project.created outbox event in the same store", async () => {
    const { auth } = await seedTenant(ctx);

    const project = await ctx.services.projects.create(auth, { name: "Alpha" });

    expect(project.name).toBe("Alpha");
    expect(project.tenantId).toBe(auth.tenantId);

    const events = ctx.store.outbox.filter((e) => e.type === "project.created");
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toMatchObject({
      projectId: project.id,
      name: "Alpha",
      actorId: auth.userId,
    });
  });

  it("lists only the calling tenant's projects (multi-tenant isolation)", async () => {
    const a = await seedTenant(ctx, "a@test.dev");
    const b = await seedTenant(ctx, "b@test.dev");

    await ctx.services.projects.create(a.auth, { name: "A1" });
    await ctx.services.projects.create(b.auth, { name: "B1" });

    expect((await ctx.services.projects.list(a.auth)).map((p) => p.name)).toEqual(
      ["A1"],
    );
    expect((await ctx.services.projects.list(b.auth)).map((p) => p.name)).toEqual(
      ["B1"],
    );
  });

  it("getById throws NotFound for another tenant's project", async () => {
    const a = await seedTenant(ctx, "a@test.dev");
    const b = await seedTenant(ctx, "b@test.dev");
    const project = await ctx.services.projects.create(a.auth, { name: "A1" });

    await expect(
      ctx.services.projects.getById(b.auth, project.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("delete cascades to the project's tasks and 404s when already gone", async () => {
    const { auth } = await seedTenant(ctx);
    const project = await ctx.services.projects.create(auth, { name: "A" });
    await ctx.services.tasks.create(auth, project.id, {
      title: "T",
      status: "todo",
    });

    await ctx.services.projects.delete(auth, project.id);

    expect(ctx.store.projects.find((p) => p.id === project.id)).toBeUndefined();
    expect(ctx.store.tasks.filter((t) => t.projectId === project.id)).toHaveLength(
      0,
    );

    await expect(
      ctx.services.projects.delete(auth, project.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("cannot delete another tenant's project", async () => {
    const a = await seedTenant(ctx, "a@test.dev");
    const b = await seedTenant(ctx, "b@test.dev");
    const project = await ctx.services.projects.create(a.auth, { name: "A1" });

    await expect(
      ctx.services.projects.delete(b.auth, project.id),
    ).rejects.toBeInstanceOf(NotFoundError);
    // Still there for the real owner.
    expect(await ctx.services.projects.getById(a.auth, project.id)).toMatchObject({
      id: project.id,
    });
  });
});
