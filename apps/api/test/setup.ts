// Test environment. Set required config before `src/config/env.ts` is imported,
// so the suite is self-contained (no real .env or database needed - services
// run against the in-memory unit of work). `||=` leaves any real env override
// in place, and dotenv (loaded by env.ts) won't clobber values already set.
process.env.JWT_ACCESS_SECRET ||= "test_access_secret";
process.env.JWT_REFRESH_SECRET ||= "test_refresh_secret";
process.env.DATABASE_URL ||= "postgres://test:test@localhost:5432/test_db";
process.env.CORS_ORIGIN ||= "http://localhost:3001";
process.env.ACCESS_TOKEN_TTL ||= "15m";
process.env.REFRESH_TOKEN_TTL ||= "7d";
