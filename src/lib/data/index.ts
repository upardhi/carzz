import 'server-only';

import type { DataStore } from './ports/store';
import { MemoryStore } from './memory/store';

export type * from './ports';
export type * from './types';

export type DataProvider = 'memory' | 'prisma' | 'firebase';

/**
 * Resolves the single {@link DataStore} the whole application talks to.
 *
 * Changing databases means changing `DATA_PROVIDER` and supplying that
 * provider's credentials — no route handler, service, or component changes.
 * The adapters are imported lazily so the app boots on `memory` without
 * `@prisma/client` or `firebase-admin` present.
 */
const globalForStore = globalThis as unknown as { __carzzStore?: DataStore };

export async function getStore(): Promise<DataStore> {
  if (globalForStore.__carzzStore) return globalForStore.__carzzStore;

  const provider = (process.env.DATA_PROVIDER ?? 'memory') as DataProvider;
  warnIfUnpooled(provider);
  let store: DataStore;

  switch (provider) {
    case 'prisma': {
      // Plain dynamic imports, deliberately: they are what Next's file
      // tracing follows when it decides which files to ship in a serverless
      // function. Hidden behind `webpackIgnore` the packages were left out of
      // the deployed bundle entirely, and every request that touched the
      // database failed with "the Prisma packages are not installed" — on the
      // host only, never locally, where node_modules is right there.
      const [{ PrismaStore }, prismaModule, adapterModule] = await Promise.all([
        import('./prisma/store'),
        import('@prisma/client').catch(() => null),
        import('@prisma/adapter-pg').catch(() => null),
      ]);
      if (!prismaModule || !adapterModule) {
        throw new Error(
          'DATA_PROVIDER=prisma but the Prisma packages are not installed.\n' +
            'Run: npm i @prisma/client @prisma/adapter-pg && npx prisma generate',
        );
      }

      const { PrismaClient } = prismaModule as {
        PrismaClient: new (options?: unknown) => unknown;
      };
      const { PrismaPg } = adapterModule as {
        PrismaPg: new (options: { connectionString: string }) => unknown;
      };

      // One client per process, reused across requests. A fresh client per
      // invocation would open its own connection pool every time and exhaust
      // the database's connection limit on a serverless host.
      const globalForPrisma = globalThis as unknown as { __carzzPrisma?: unknown };
      globalForPrisma.__carzzPrisma ??= new PrismaClient({
        // Prisma 7 connects through a driver adapter. node-postgres speaks to
        // any Postgres — Neon, Supabase, RDS, a plain server — so the host
        // stays a deployment choice rather than a code one.
        adapter: new PrismaPg({
          connectionString: requireEnv('DATABASE_URL'),
        }),
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      });

      store = new PrismaStore(globalForPrisma.__carzzPrisma as never);
      break;
    }

    case 'firebase': {
      const [{ FirestoreStore }, adminApp, adminFirestore] = await Promise.all([
        import('./firebase/store'),
        import(/* webpackIgnore: true */ 'firebase-admin/app' as string).catch(() => null),
        import(/* webpackIgnore: true */ 'firebase-admin/firestore' as string).catch(() => null),
      ]);
      if (!adminApp || !adminFirestore) {
        throw new Error(
          'DATA_PROVIDER=firebase but firebase-admin is not installed. ' +
            'Run: npm i firebase-admin',
        );
      }
      const { getApps, initializeApp, cert } = adminApp as {
        getApps: () => unknown[];
        initializeApp: (o: unknown) => unknown;
        cert: (o: unknown) => unknown;
      };
      const { getFirestore } = adminFirestore as { getFirestore: () => unknown };

      if (!getApps().length) {
        initializeApp({
          credential: cert({
            projectId: requireEnv('FIREBASE_PROJECT_ID'),
            clientEmail: requireEnv('FIREBASE_CLIENT_EMAIL'),
            // Private keys arrive from env with escaped newlines.
            privateKey: requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
          }),
        });
      }
      store = new FirestoreStore(getFirestore() as never);
      break;
    }

    case 'memory':
    default:
      warnIfEphemeral();
      store = new MemoryStore();
      break;
  }

  globalForStore.__carzzStore = store;
  return store;
}

/**
 * The memory store is a fresh copy of the demo seed in every process — right
 * for local work and the smoke suite, wrong for a deployment. On a serverless
 * host each instance holds its own copy, so two people see different data and
 * every save is lost when an instance is recycled.
 */
function warnIfEphemeral(): void {
  if (process.env.NODE_ENV !== 'production') return;
  console.warn(
    'Running on the in-memory demo store, so nothing is saved: each server ' +
      'instance keeps its own copy and loses it when recycled. Set ' +
      'DATA_PROVIDER=prisma with DATABASE_URL (the pooled connection string) ' +
      'and DIRECT_URL before using this deployment for real work.',
  );
}

/**
 * A serverless deployment pointed at a direct Postgres endpoint works fine in
 * testing and then fails under real traffic with "too many connections". Say
 * so at boot, while the cause is still obvious.
 */
function warnIfUnpooled(provider: DataProvider): void {
  if (provider !== 'prisma') return;
  const url = process.env.DATABASE_URL ?? '';
  if (!url || url.includes('-pooler.') || url.includes('pgbouncer=true')) return;

  console.warn(
    'DATABASE_URL does not look like a pooled endpoint. On a serverless host ' +
      'each invocation opens its own connection and the limit is quickly ' +
      'exhausted. Use your provider\'s pooled connection string for ' +
      'DATABASE_URL (on Neon, the host containing "-pooler"), and keep the ' +
      'direct one in DIRECT_URL for migrations.',
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}
