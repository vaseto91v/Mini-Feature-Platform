import type { LoginInput, Organization, RegisterInput, User } from "@mfp/shared";
import { ConflictError, NotFoundError, UnauthorizedError } from "../http/errors";
import type { SystemRepositories, UnitOfWork } from "../repositories/types";
import type { PasswordService } from "./password.service";
import type { TokenService } from "./token.service";
import type { AuthContext } from "./types";

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordService,
  ) {}

  register(input: RegisterInput): Promise<AuthResult> {
    return this.uow.withSystem(async (repos) => {
      const existing = await repos.users.findByEmail(input.email);
      if (existing) throw new ConflictError("Email already registered");

      const tenant = await repos.tenants.create({ name: input.organizationName });
      const passwordHash = await this.passwords.hash(input.password);
      // The first user of a tenant is its owner.
      const user = await repos.users.create({
        tenantId: tenant.id,
        email: input.email,
        passwordHash,
        role: "owner",
      });

      const issued = await this.issueTokens(repos, {
        userId: user.id,
        tenantId: tenant.id,
        role: "owner",
      });
      return { user, ...issued };
    });
  }

  login(input: LoginInput): Promise<AuthResult> {
    return this.uow.withSystem(async (repos) => {
      const found = await repos.users.findByEmail(input.email);
      // Verify even when the user is missing to reduce timing/enumeration signal.
      const passwordHash =
        found?.passwordHash ??
        "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const ok = await this.passwords.verify(passwordHash, input.password);
      if (!found || !ok) throw new UnauthorizedError("Invalid credentials");

      const { passwordHash: _hash, ...user } = found;
      const issued = await this.issueTokens(repos, {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
      });
      return { user, ...issued };
    });
  }

  /** Validates a refresh token, revokes it, and issues a fresh pair (rotation). */
  refresh(refreshToken: string): Promise<AuthResult> {
    return this.uow.withSystem(async (repos) => {
      const stored = await repos.refreshTokens.findActiveByHash(
        this.tokens.hashRefreshToken(refreshToken),
      );
      if (!stored) throw new UnauthorizedError("Invalid refresh token");
      await repos.refreshTokens.revokeById(stored.id);

      const found = await repos.users.findById(stored.userId);
      if (!found) throw new UnauthorizedError("Invalid refresh token");

      const { passwordHash: _hash, ...user } = found;
      const issued = await this.issueTokens(repos, {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
      });
      return { user, ...issued };
    });
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.uow.withSystem(async (repos) => {
      const stored = await repos.refreshTokens.findActiveByHash(
        this.tokens.hashRefreshToken(refreshToken),
      );
      if (stored) await repos.refreshTokens.revokeById(stored.id);
    });
  }

  me(ctx: AuthContext): Promise<User> {
    return this.uow.withSystem(async (repos) => {
      const found = await repos.users.findById(ctx.userId);
      if (!found) throw new UnauthorizedError();
      const { passwordHash: _hash, ...user } = found;
      return user;
    });
  }

  /** The caller's tenant plus its members - backs the Members/Settings views. */
  getOrganization(ctx: AuthContext): Promise<Organization> {
    return this.uow.withSystem(async (repos) => {
      const tenant = await repos.tenants.findById(ctx.tenantId);
      if (!tenant) throw new NotFoundError("Organization not found");
      const members = await repos.users.listByTenant(ctx.tenantId);
      return {
        id: tenant.id,
        name: tenant.name,
        createdAt: tenant.createdAt,
        members,
      };
    });
  }

  private async issueTokens(
    repos: SystemRepositories,
    ctx: AuthContext,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.tokens.signAccessToken(ctx);
    const refreshToken = this.tokens.generateRefreshToken();
    await repos.refreshTokens.create({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      tokenHash: this.tokens.hashRefreshToken(refreshToken),
      expiresAt: this.tokens.refreshTokenExpiry(),
    });
    return { accessToken, refreshToken };
  }
}
