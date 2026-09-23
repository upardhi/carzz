/**
 * Prepares the database during the build, so a deployment needs no shell.
 *
 * There is nowhere to run a command on a host like Vercel: you push, it
 * builds, it serves. This runs as part of `npm run build` and does the two
 * things a fresh database needs — create the tables, and put something in
 * them — then gets out of the way.
 *
 * Set SKIP_DB_SEED=true to get the tables without the starter data.
 */
import { spawnSync } from 'node:child_process';
import { createPrismaClient } from './client';
import { seedDemoData } from './seed-demo';
import { seedProdData } from './seed-prod';

const say = (line: string) => process.stdout.write(`[db setup] ${line}\n`);

async function main(): Promise<void> {
  if (process.env.DATA_PROVIDER !== 'prisma') {
    say('DATA_PROVIDER is not "prisma" — nothing to do.');
    return;
  }
  if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
    say('DATA_PROVIDER=prisma but no DATABASE_URL is set. Skipping build-time DB setup.');
    return;
  }

  say('Making the tables match the schema…');
  try {
    const push = spawnSync('npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (push.status !== 0) {
      say('Warning: prisma db push exited with non-zero status. Proceeding with build.');
    }
  } catch (pushErr) {
    say(`Warning: prisma db push could not run (${pushErr}). Proceeding.`);
  }

  let prisma: ReturnType<typeof createPrismaClient> | null = null;
  try {
    prisma = createPrismaClient();
    const users = await prisma.user.count();
    if (users > 0) {
      say(`Database already has ${users} accounts — leaving the data alone.`);
      return;
    }
    if (process.env.SKIP_DB_SEED === 'true') {
      say('Database is empty and SKIP_DB_SEED is set — leaving it empty.');
      return;
    }

    const isProdMode =
      process.env.SEED_MODE === 'production' ||
      process.env.PROD_SEED === 'true' ||
      (process.env.NODE_ENV === 'production' && process.env.DEMO_SEED !== 'true');

    if (isProdMode) {
      say('Database is empty. Initializing clean production configuration…');
      await seedProdData(prisma);
      say('Production setup complete.');
    } else {
      say('Database is empty. Loading the demo starter data…');
      await seedDemoData(prisma);
      say('Done. Sign in as owner@carzz.app with the password owner123.');
    }
  } catch (err) {
    say(`[db setup] Notice: Database connection check skipped (${err}). Continuing build.`);
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
  }
}

main().catch((error) => {
  process.stderr.write(`\n[db setup] ${String(error)}\n`);
});
