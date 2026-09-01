import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * The Prisma client used by the Node-side scripts (seeding and setup).
 *
 * Prisma 7 talks to the database through a driver adapter rather than its own
 * engine. These scripts use the *direct* connection when there is one: they
 * write tens of thousands of rows in a handful of long transactions, and issue
 * DDL — the two workloads a connection pooler handles worst.
 */
export function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'Set DATABASE_URL (and DIRECT_URL, if your host has a pooler) first.',
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
