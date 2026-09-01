/**
 * Loads the starter dataset into a Postgres database.
 *
 *   npm run db:push && npm run db:seed
 *
 * This CLEARS every table first, so run it on a fresh database or one you are
 * deliberately resetting. The deployment path does not use it directly: see
 * `prisma/setup.ts`, which seeds only a database that is completely empty.
 */
import { createPrismaClient } from './client';
import { seedDemoData } from './seed-demo';

const prisma = createPrismaClient();

seedDemoData(prisma)
  .then(() => {
    process.stdout.write(
      '\nDone. Sign in as owner@carzz.app / owner123 with DATA_PROVIDER=prisma.\n',
    );
  })
  .catch((error) => {
    process.stderr.write(`\nSeed failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
