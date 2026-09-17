/**
 * Prepares the database during the build, so a deployment needs no shell.
 *
 * There is nowhere to run a command on a host like Vercel: you push, it
 * builds, it serves. This runs as part of `npm run build` and does the two
 * things a fresh database needs — create the tables, and put something in
 * them — then gets out of the way.
 *
 * It is safe to run on every deploy, which it does:
 *
 *   - it does nothing at all unless DATA_PROVIDER=prisma
 *   - `prisma db push` is a no-op once the tables match the schema, and
 *     refuses rather than dropping a column that would lose data
 *   - the starter data is loaded ONLY into a database with no users in it.
 *     A database with your real customers in it is never touched.
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
    throw new Error(
      'DATA_PROVIDER=prisma but no DATABASE_URL is set. Add the connection ' +
        'string to the deployment\'s environment variables.',
    );
  }

  say('Making the tables match the schema…');
  // Through npx so this works whether or not node_modules/.bin is on PATH —
  // it is when npm runs the build, and is not when the file is run directly.
  const push = spawnSync('npx', ['prisma', 'db', 'push'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (push.status !== 0) {
    throw new Error(
      'prisma db push failed. If it reported possible data loss it has ' +
        'changed nothing: apply that change yourself, deliberately.',
    );
  }

  const prisma = createPrismaClient();
  try {
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
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`\n[db setup] ${String(error)}\n`);
  process.exit(1);
});
