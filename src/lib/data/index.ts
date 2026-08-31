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
  let store: DataStore;

  switch (provider) {
    case 'prisma': {
      const [{ PrismaStore }, prismaModule] = await Promise.all([
        import('./prisma/store'),
        // Not a static import: the package is only installed when this
        // provider is actually used.
        import(/* webpackIgnore: true */ '@prisma/client' as string).catch(() => null),
      ]);
      if (!prismaModule) {
        throw new Error(
          'DATA_PROVIDER=prisma but @prisma/client is not installed. ' +
            'Run: npm i @prisma/client prisma && npx prisma generate',
        );
      }
      const { PrismaClient } = prismaModule as { PrismaClient: new () => unknown };
      store = new PrismaStore(new PrismaClient() as never);
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
      store = new MemoryStore();
      break;
  }

  globalForStore.__carzzStore = store;
  return store;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}
