import type {
  CreateInput,
  FindOptions,
  Repository,
  Where,
} from '../ports/repository';
import type { Id } from '../types';

/* Structural types for the Firestore Admin SDK, so this file compiles without
 * `firebase-admin` installed. Install it when DATA_PROVIDER=firebase. */
export interface FirestoreQuery {
  where(field: string, op: string, value: unknown): FirestoreQuery;
  orderBy(field: string, dir?: 'asc' | 'desc'): FirestoreQuery;
  limit(n: number): FirestoreQuery;
  offset(n: number): FirestoreQuery;
  get(): Promise<{ docs: { id: string; data(): unknown }[]; size: number }>;
}

export interface FirestoreCollection extends FirestoreQuery {
  doc(id?: string): FirestoreDoc;
}

export interface FirestoreDoc {
  id: string;
  get(): Promise<{ exists: boolean; id: string; data(): unknown }>;
  set(data: unknown, options?: { merge: boolean }): Promise<unknown>;
  update(data: unknown): Promise<unknown>;
  delete(): Promise<unknown>;
}

const OP: Record<string, string> = {
  eq: '==', ne: '!=', in: 'in', notIn: 'not-in',
  gt: '>', gte: '>=', lt: '<', lte: '<=', has: 'array-contains',
};

/**
 * Firestore-backed repository.
 *
 * Two deliberate compromises, both invisible to callers:
 *   - `contains` has no Firestore equivalent, so it is applied in memory after
 *     the query. Pair it with an indexed equality filter (an areaId, say) so
 *     the server-side result set stays small.
 *   - `offset` bills for skipped documents. Prefer `limit` with a narrowing
 *     `where` on hot paths.
 */
export class FirestoreRepository<T extends { id: Id }> implements Repository<T> {
  constructor(private readonly collection: FirestoreCollection) {}

  private build(options: FindOptions<T> = {}) {
    let q: FirestoreQuery = this.collection;
    const inMemory: [string, string][] = [];

    for (const [field, filter] of Object.entries(options.where ?? {})) {
      if (filter === undefined) continue;
      if (filter === null || typeof filter !== 'object' || Array.isArray(filter)) {
        q = q.where(field, '==', filter);
        continue;
      }
      for (const [op, value] of Object.entries(filter as Record<string, unknown>)) {
        if (op === 'contains') {
          inMemory.push([field, String(value).toLowerCase()]);
          continue;
        }
        const fsOp = OP[op];
        if (fsOp) q = q.where(field, fsOp, value);
      }
    }

    for (const o of options.orderBy ?? []) {
      q = q.orderBy(String(o.field), o.dir ?? 'asc');
    }
    // Paging is applied after the in-memory `contains` pass, so only push it
    // down when there is nothing left to filter client-side.
    if (!inMemory.length) {
      if (options.offset) q = q.offset(options.offset);
      if (options.limit !== undefined) q = q.limit(options.limit);
    }

    return { q, inMemory };
  }

  async get(id: Id): Promise<T | null> {
    const snap = await this.collection.doc(id).get();
    return snap.exists ? ({ ...(snap.data() as object), id: snap.id } as T) : null;
  }

  async find(options: FindOptions<T> = {}): Promise<T[]> {
    const { q, inMemory } = this.build(options);
    const snap = await q.get();
    let rows = snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);

    if (inMemory.length) {
      rows = rows.filter((row) =>
        inMemory.every(([field, needle]) =>
          String((row as Record<string, unknown>)[field] ?? '')
            .toLowerCase()
            .includes(needle),
        ),
      );
      const start = options.offset ?? 0;
      const end = options.limit === undefined ? undefined : start + options.limit;
      rows = rows.slice(start, end);
    }

    return rows;
  }

  async findOne(options: FindOptions<T> = {}): Promise<T | null> {
    const [row] = await this.find({ ...options, limit: 1 });
    return row ?? null;
  }

  async count(where?: Where<T>): Promise<number> {
    const { q, inMemory } = this.build({ where });
    if (!inMemory.length) return (await q.get()).size;
    return (await this.find({ where })).length;
  }

  async create(data: CreateInput<T>): Promise<T> {
    const { id, ...rest } = data as CreateInput<T> & { id?: Id };
    const doc = this.collection.doc(id);
    await doc.set(rest);
    return { ...(rest as object), id: doc.id } as T;
  }

  async createMany(data: CreateInput<T>[]): Promise<T[]> {
    return Promise.all(data.map((d) => this.create(d)));
  }

  async update(id: Id, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    await this.collection.doc(id).update(patch);
    const row = await this.get(id);
    if (!row) throw new Error(`Document ${id} not found after update`);
    return row;
  }

  async updateMany(
    where: Where<T>,
    patch: Partial<Omit<T, 'id'>>,
  ): Promise<number> {
    const rows = await this.find({ where });
    await Promise.all(rows.map((r) => this.collection.doc(r.id).update(patch)));
    return rows.length;
  }

  async delete(id: Id): Promise<void> {
    await this.collection.doc(id).delete();
  }

  async deleteMany(where: Where<T>): Promise<number> {
    const rows = await this.find({ where });
    await Promise.all(rows.map((r) => this.collection.doc(r.id).delete()));
    return rows.length;
  }
}
