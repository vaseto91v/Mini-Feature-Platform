import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bearer,
  buildTestContext,
  registerViaApi,
  type TestContext,
} from "../helpers";

describe("API integration", () => {
  let ctx: TestContext;
  let app: FastifyInstance;

  beforeEach(async () => {
    ctx = buildTestContext();
    app = ctx.app;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("health check responds", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("registers a user and sets an httpOnly refresh cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        organizationName: "Acme",
        email: "owner@acme.test",
        password: "supersecret123",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().accessToken).toBeTruthy();
    expect(res.json().user).toMatchObject({ email: "owner@acme.test", role: "owner" });

    const cookie = res.cookies.find((c) => c.name === "refresh_token");
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.path).toBe("/api/auth");
  });

  it("rejects unauthenticated access to protected routes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/projects" });
    expect(res.statusCode).toBe(401);
  });

  it("validates the request body (empty project name -> 400)", async () => {
    const { token } = await registerViaApi(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: bearer(token),
      payload: { name: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("validation_error");
  });

  it("runs the full project + task lifecycle", async () => {
    const { token } = await registerViaApi(app);
    const auth = bearer(token);

    // Create + list project.
    const created = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: auth,
      payload: { name: "Website redesign" },
    });
    expect(created.statusCode).toBe(201);
    const project = created.json();

    const list = await app.inject({
      method: "GET",
      url: "/api/projects",
      headers: auth,
    });
    expect(list.json()).toHaveLength(1);

    // Create a task, then move it.
    const taskRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/tasks`,
      headers: auth,
      payload: { title: "Hero section" },
    });
    expect(taskRes.statusCode).toBe(201);
    const task = taskRes.json();
    expect(task.status).toBe("todo");

    const moved = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${task.id}/status`,
      headers: auth,
      payload: { status: "in_progress" },
    });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().status).toBe("in_progress");

    // "My issues" lists across projects.
    const allTasks = await app.inject({
      method: "GET",
      url: "/api/tasks",
      headers: auth,
    });
    expect(allTasks.json()).toHaveLength(1);

    // Delete task then project (204s).
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/tasks/${task.id}`,
          headers: auth,
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/projects/${project.id}`,
          headers: auth,
        })
      ).statusCode,
    ).toBe(204);

    const empty = await app.inject({
      method: "GET",
      url: "/api/projects",
      headers: auth,
    });
    expect(empty.json()).toHaveLength(0);
  });

  it("isolates tenants - one org cannot read another's project", async () => {
    const orgA = await registerViaApi(app, { email: "a@test.dev" });
    const orgB = await registerViaApi(app, { email: "b@test.dev" });

    const project = (
      await app.inject({
        method: "POST",
        url: "/api/projects",
        headers: bearer(orgA.token),
        payload: { name: "Secret A" },
      })
    ).json();

    // Org B can't list tasks of org A's project (project not visible -> 404).
    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${project.id}/tasks`,
      headers: bearer(orgB.token),
    });
    expect(res.statusCode).toBe(404);

    // ...and B's own project list stays empty.
    const bProjects = await app.inject({
      method: "GET",
      url: "/api/projects",
      headers: bearer(orgB.token),
    });
    expect(bProjects.json()).toHaveLength(0);
  });

  it("returns the organization with its members", async () => {
    const { token, user } = await registerViaApi(app, { email: "owner@org.test" });
    const res = await app.inject({
      method: "GET",
      url: "/api/organization",
      headers: bearer(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: user.tenantId });
    expect(res.json().members).toHaveLength(1);
  });

  it("projects events into the activity feed via the outbox dispatcher", async () => {
    const { token } = await registerViaApi(app);
    const auth = bearer(token);
    const project = (
      await app.inject({
        method: "POST",
        url: "/api/projects",
        headers: auth,
        payload: { name: "Eventful" },
      })
    ).json();

    // Drain the outbox -> bus -> activity consumer.
    await ctx.dispatcher.tick();

    const activity = await app.inject({
      method: "GET",
      url: `/api/projects/${project.id}/activity`,
      headers: auth,
    });
    expect(activity.statusCode).toBe(200);
    const types = activity.json().map((a: { type: string }) => a.type);
    expect(types).toContain("project.created");
  });
});
