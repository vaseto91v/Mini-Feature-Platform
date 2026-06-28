/** Error thrown by the API client, carrying the server's error envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, payload: unknown) {
    const envelope = (payload as { error?: { message?: string; code?: string; details?: unknown } })
      ?.error;
    super(envelope?.message ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = envelope?.code;
    this.details = envelope?.details;
  }
}
