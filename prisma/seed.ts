/**
 * Loads the dataset into a Postgres database.
 *
 *   npm run db:push && npm run db:seed
 *   npm run db:push && npm run db:seed:prod
 *
 * This CLEARS every table first, so run it on a fresh database or one you are
 * deliberately resetting.
 */
import { createPrismaClient } from './client';
import { seedDemoData } from './seed-demo';
import { seedProdData } from './seed-prod';

const prisma = createPrismaClient();

const isProd = process.env.SEED_MODE === 'production' || process.env.PROD_SEED === 'true';

const run = isProd ? seedProdData(prisma) : seedDemoData(prisma);

run
  .then(() => {
    if (!isProd) {
      process.stdout.write(
        '\nDone. Sign in as owner@carzz.app / owner123 with DATA_PROVIDER=prisma.\n',
      );
    }
  })
  .catch((error) => {
    process.stderr.write(`\nSeed failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

