import { z } from "zod";

/** A v4 UUID, used for all entity identifiers. */
export const uuidSchema = z.string().uuid();

/** ISO-8601 timestamp as serialized over the wire (e.g. Date.toISOString()). */
export const isoDateTimeSchema = z.string().datetime();

/** Standard list pagination. Coerced so it works straight from query strings. */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Consistent error envelope returned by the API on failure. */
export const errorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
