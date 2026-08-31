import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Configuration for the Prisma CLI (migrations and the seed script).
 *
 * Migrations need a *direct* database connection: a connection pooler such as
 * Neon's cannot run the DDL a migration issues. The application itself uses
 * the pooled URL instead — see src/lib/data/index.ts.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Falls back to DATABASE_URL, which is correct when there is no pooler
    // (a plain Postgres server, or local development).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
