import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, UnauthorizedError } from "../../src/http/errors";
import { buildTestContext, type TestContext } from "../helpers";

const REGISTER = {
  organizationName: "Acme",
  email: "owner@acme.test",
  password: "supersecret123",
};

describe("AuthService", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = buildTestContext();
  });

  it("register creates a tenant with an owner and returns tokens", async () => {
    const { user, accessToken, refreshToken } =
      await ctx.services.auth.register(REGISTER);

    expect(user.email).toBe("owner@acme.test");
    expect(user.role).toBe("owner");
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
    expect(ctx.store.tenants).toHaveLength(1);
    expect(ctx.store.tenants[0]!.name).toBe("Acme");
  });

  it("register rejects a duplicate email with Conflict", async () => {
    await ctx.services.auth.register(REGISTER);
    await expect(ctx.services.auth.register(REGISTER)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("login succeeds with valid credentials and fails otherwise", async () => {
    await ctx.services.auth.register(REGISTER);

    const ok = await ctx.services.auth.login({
      email: REGISTER.email,
      password: REGISTER.password,
    });
    expect(ok.accessToken).toBeTruthy();

    await expect(
      ctx.services.auth.login({ email: REGISTER.email, password: "wrong" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    await expect(
      ctx.services.auth.login({ email: "nobody@acme.test", password: "x" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("refresh rotates the token - the old token cannot be reused", async () => {
    const { refreshToken } = await ctx.services.auth.register(REGISTER);

    const rotated = await ctx.services.auth.refresh(refreshToken);
    expect(rotated.refreshToken).not.toBe(refreshToken);

    // The original (now revoked) token is rejected.
    await expect(ctx.services.auth.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    // The freshly issued one works.
    expect((await ctx.services.auth.refresh(rotated.refreshToken)).accessToken).toBeTruthy();
  });

  it("logout revokes the refresh token", async () => {
    const { refreshToken } = await ctx.services.auth.register(REGISTER);
    await ctx.services.auth.logout(refreshToken);
    await expect(ctx.services.auth.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("getOrganization returns the tenant and its members", async () => {
    const { user } = await ctx.services.auth.register(REGISTER);

    const org = await ctx.services.auth.getOrganization({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
    });

    expect(org).toMatchObject({ id: user.tenantId, name: "Acme" });
    expect(org.members).toHaveLength(1);
    expect(org.members[0]!.email).toBe("owner@acme.test");
    // Members must never carry the password hash.
    expect(org.members[0]).not.toHaveProperty("passwordHash");
  });
});
