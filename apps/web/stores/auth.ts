import type { AuthResponse, LoginInput, RegisterInput, User } from "@mfp/shared";
import { defineStore } from "pinia";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(null);
  const initialized = ref(false);

  const config = useRuntimeConfig();
  const base = `${config.public.apiBase}/api`;

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value);

  // Direct fetch (not useApi) - these endpoints establish the session.
  async function call(path: string, body?: unknown): Promise<AuthResponse> {
    const res = await fetch(base + path, {
      method: "POST",
      headers: body !== undefined ? { "content-type": "application/json" } : {},
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data);
    return data as AuthResponse;
  }

  function setSession(data: AuthResponse): void {
    user.value = data.user;
    accessToken.value = data.accessToken;
  }

  async function register(input: RegisterInput): Promise<void> {
    setSession(await call("/auth/register", input));
  }

  async function login(input: LoginInput): Promise<void> {
    setSession(await call("/auth/login", input));
  }

  /** Exchanges the httpOnly refresh cookie for a new access token. */
  async function refresh(): Promise<boolean> {
    try {
      setSession(await call("/auth/refresh"));
      return true;
    } catch {
      user.value = null;
      accessToken.value = null;
      return false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await call("/auth/logout");
    } catch {
      /* best effort */
    }
    user.value = null;
    accessToken.value = null;
  }

  /** Restores a session on first load using the refresh cookie. */
  async function init(): Promise<void> {
    if (initialized.value) return;
    await refresh();
    initialized.value = true;
  }

  return {
    user,
    accessToken,
    initialized,
    isAuthenticated,
    register,
    login,
    refresh,
    logout,
    init,
  };
});
