import type { ZodTypeAny, z } from "zod";

export type ValidationResult<T> =
  | { success: true; data: T; errors: Record<string, string> }
  | { success: false; data: null; errors: Record<string, string> };

/**
 * Validates form input against a shared Zod schema and returns the first error
 * message per field. These are the SAME schemas the API enforces (single source
 * of truth in `@mfp/shared`), so the client can never disagree with the server
 * about what's valid. On success, `data` is the parsed/normalised output
 * (e.g. trimmed name, lower-cased email, defaulted status) - submit that, not
 * the raw input.
 */
export function validateWith<S extends ZodTypeAny>(
  schema: S,
  input: unknown,
): ValidationResult<z.output<S>> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { success: true, data: parsed.data, errors: {} };

  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "");
    // Keep the first message per field (closest to what the user should fix).
    if (field && !(field in errors)) errors[field] = issue.message;
  }
  return { success: false, data: null, errors };
}
