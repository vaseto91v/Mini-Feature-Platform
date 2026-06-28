// Single-flight refresh shared across all in-flight requests.
let refreshPromise: Promise<boolean> | null = null;

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  retry?: boolean;
}

/**
 * Thin typed fetch wrapper for the JSON API. Attaches the in-memory access
 * token, sends the refresh cookie, and on a 401 transparently refreshes the
 * token once and retries.
 */
export function useApi() {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  const base = `${config.public.apiBase}/api`;

  async function ensureRefresh(): Promise<boolean> {
    if (!refreshPromise) {
      refreshPromise = auth.refresh().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, auth: useAuth = true, retry = true } = options;
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (useAuth && auth.accessToken) {
      headers.authorization = `Bearer ${auth.accessToken}`;
    }

    const res = await fetch(base + path, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && useAuth && retry) {
      const refreshed = await ensureRefresh();
      if (refreshed) return request<T>(path, { ...options, retry: false });
    }

    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data);
    return data as T;
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
    del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  };
}
