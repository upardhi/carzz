import type { Id } from '../types';

/**
 * A declarative filter language, deliberately small enough that every backend
 * can express it natively:
 *
 *   memory   — evaluated in JS
 *   prisma   — maps 1:1 onto Prisma's `where` operators
 *   firebase — maps onto Firestore `where()` clauses, except `contains`, which
 *              the adapter applies in memory after the query (documented there)
 *
 * Keeping the language this narrow is what makes the database choice
 * reversible: no caller ever writes SQL or a Firestore query.
 */
export type FieldFilter<V> =
  | V
  | {
      eq?: V;
      ne?: V;
      in?: readonly V[];
      notIn?: readonly V[];
      gt?: V;
      gte?: V;
      lt?: V;
      lte?: V;
      /** Case-insensitive substring match. String fields only. */
      contains?: string;
      /** Matches when an array-valued field contains this element. */
      has?: V extends readonly (infer E)[] ? E : never;
    };

export type Where<T> = { [K in keyof T]?: FieldFilter<T[K]> };

export interface OrderBy<T> {
  field: keyof T;
  dir?: 'asc' | 'desc';
}

export interface FindOptions<T> {
  where?: Where<T>;
  orderBy?: OrderBy<T>[];
  limit?: number;
  offset?: number;
}

/** Input for a create: `id` is optional and generated when omitted. */
export type CreateInput<T extends { id: Id }> = Omit<T, 'id'> & { id?: Id };

export interface Repository<T extends { id: Id }> {
  get(id: Id): Promise<T | null>;
  find(options?: FindOptions<T>): Promise<T[]>;
  findOne(options?: FindOptions<T>): Promise<T | null>;
  count(where?: Where<T>): Promise<number>;
  create(data: CreateInput<T>): Promise<T>;
  createMany(data: CreateInput<T>[]): Promise<T[]>;
  update(id: Id, patch: Partial<Omit<T, 'id'>>): Promise<T>;
  updateMany(where: Where<T>, patch: Partial<Omit<T, 'id'>>): Promise<number>;
  delete(id: Id): Promise<void>;
  deleteMany(where: Where<T>): Promise<number>;
}
