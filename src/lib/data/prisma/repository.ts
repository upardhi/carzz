import type {
  CreateInput,
  FindOptions,
  Repository,
  Where,
} from '../ports/repository';
import type { Id } from '../types';
import { NO_DATE_FIELDS, type DateFields } from './fields';

/** The subset of a Prisma model delegate this adapter needs. */
export interface PrismaDelegate {
  findUnique(args: { where: { id: string } }): Promise<unknown>;
  findMany(args: Record<string, unknown>): Promise<unknown[]>;
  /**
   * Finds the first matching row without allocating a result array.
   * Always faster than findMany(take:1) for single-row lookups.
   */
  findFirst(args: Record<string, unknown>): Promise<unknown>;
  count(args: Record<string, unknown>): Promise<number>;
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  createMany(args: { data: Record<string, unknown>[] }): Promise<unknown>;
  /**
   * INSERT … RETURNING — inserts rows and returns them in one round-trip.
   * Supported on PostgreSQL and SQLite ≥ 3.35; undefined on MySQL/MariaDB.
   * The repository uses this when present, falling back to createMany+find.
   */
  createManyAndReturn?(args: {
    data: Record<string, unknown>[];
  }): Promise<unknown[]>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<unknown>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
  delete(args: { where: { id: string } }): Promise<unknown>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
}

/**
 * Postgres columns hold real dates; the domain holds strings. These two
 * translate between them, in both directions, for exactly the columns
 * `DATE_FIELDS` lists — everything else passes through untouched.
 */
type DateKind = 'date' | 'timestamp';

function kindOf(fields: DateFields, field: string): DateKind | null {
  if (fields.dateOnly.includes(field)) return 'date';
  if (fields.timestamp.includes(field)) return 'timestamp';
  return null;
}

function toDb(kind: DateKind, value: unknown): unknown {
  if (value === null || value === undefined || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => toDb(kind, v));
  if (typeof value !== 'string') return value;
  // A date-only column is midnight UTC: the app's own timezone handling has
  // already resolved the business day, so no local-time shift belongs here.
  return kind === 'date' ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
}

function fromDb(kind: DateKind, value: unknown): unknown {
  if (!(value instanceof Date)) return value;
  const iso = value.toISOString();
  return kind === 'date' ? iso.slice(0, 10) : iso;
}

/** A row as Postgres returned it → the shape the rest of the app expects. */
export function fromDbRow<T>(row: unknown, fields: DateFields): T {
  if (!row || typeof row !== 'object') return row as T;
  const out = { ...(row as Record<string, unknown>) };
  for (const field of fields.dateOnly) {
    if (field in out) out[field] = fromDb('date', out[field]);
  }
  for (const field of fields.timestamp) {
    if (field in out) out[field] = fromDb('timestamp', out[field]);
  }
  return out as T;
}

/** The inverse, for the `data` of a create or an update. */
export function toDbData(
  data: Record<string, unknown>,
  fields: DateFields,
): Record<string, unknown> {
  const out = { ...data };
  for (const field of fields.dateOnly) {
    if (field in out) out[field] = toDb('date', out[field]);
  }
  for (const field of fields.timestamp) {
    if (field in out) out[field] = toDb('timestamp', out[field]);
  }
  return out;
}

/**
 * Translates the portable filter language into Prisma's `where` shape.
 *
 * The operators line up almost exactly; the only special cases are `contains`
 * (which gets Prisma's case-insensitive mode) and `has` (array membership).
 * Date columns are converted here too — a filter on a date is as common as
 * reading one, and comparing a string against a `timestamp` column is an
 * error Postgres reports only at query time.
 */
export function toPrismaWhere<T>(
  where?: Where<T>,
  fields: DateFields = NO_DATE_FIELDS,
): Record<string, unknown> {
  if (!where) return {};
  const out: Record<string, unknown> = {};

  for (const [field, filter] of Object.entries(where)) {
    if (filter === undefined) continue;
    const kind = kindOf(fields, field);
    const cast = (value: unknown) => (kind ? toDb(kind, value) : value);

    if (filter === null || typeof filter !== 'object' || Array.isArray(filter)) {
      out[field] = cast(filter);
      continue;
    }

    const filterObject = filter as Record<string, unknown>;
    const clause: Record<string, unknown> = {};
    if ('eq' in filterObject) clause.equals = cast(filterObject.eq);
    if ('ne' in filterObject) clause.not = cast(filterObject.ne);
    if ('in' in filterObject) clause.in = cast(filterObject.in);
    if ('notIn' in filterObject) clause.notIn = cast(filterObject.notIn);
    if ('gt' in filterObject) clause.gt = cast(filterObject.gt);
    if ('gte' in filterObject) clause.gte = cast(filterObject.gte);
    if ('lt' in filterObject) clause.lt = cast(filterObject.lt);
    if ('lte' in filterObject) clause.lte = cast(filterObject.lte);
    if ('contains' in filterObject) {
      clause.contains = filterObject.contains;
      clause.mode = 'insensitive';
    }
    if ('has' in filterObject) clause.has = filterObject.has;

    out[field] = Object.keys(clause).length ? clause : cast(filter);
  }

  return out;
}

export class PrismaRepository<T extends { id: Id }> implements Repository<T> {
  constructor(
    private readonly delegate: PrismaDelegate,
    private readonly fields: DateFields = NO_DATE_FIELDS,
  ) {}

  private row(value: unknown): T {
    return fromDbRow<T>(value, this.fields);
  }

  async get(id: Id): Promise<T | null> {
    const row = await this.delegate.findUnique({ where: { id } });
    return row ? this.row(row) : null;
  }

  async find(options: FindOptions<T> = {}): Promise<T[]> {
    const rows = await this.delegate.findMany({
      where: toPrismaWhere(options.where, this.fields),
      orderBy: options.orderBy?.map((o) => ({ [o.field]: o.dir ?? 'asc' })),
      take: options.limit,
      skip: options.offset,
    });
    return rows.map((row) => this.row(row));
  }

  async findOne(options: FindOptions<T> = {}): Promise<T | null> {
    // findFirst skips the findMany array-allocation path: one row in, one row
    // out, no intermediate array or loop over the remaining elements.
    const row = await this.delegate.findFirst({
      where: toPrismaWhere(options.where, this.fields),
      orderBy: options.orderBy?.map((o) => ({ [o.field]: o.dir ?? 'asc' })),
    });
    return row ? this.row(row) : null;
  }

  async count(where?: Where<T>): Promise<number> {
    return this.delegate.count({ where: toPrismaWhere(where, this.fields) });
  }

  async create(data: CreateInput<T>): Promise<T> {
    return this.row(
      await this.delegate.create({
        data: toDbData(data as Record<string, unknown>, this.fields),
      }),
    );
  }

  async createMany(data: CreateInput<T>[]): Promise<T[]> {
    const rows = data.map((d) =>
      toDbData(d as Record<string, unknown>, this.fields),
    );

    if (this.delegate.createManyAndReturn) {
      // Single round-trip: INSERT … RETURNING eliminates the follow-up SELECT.
      // Available on PostgreSQL (always) and SQLite ≥ 3.35.
      const created = await this.delegate.createManyAndReturn({ data: rows });
      return created.map((row) => this.row(row));
    }

    // Fallback for MySQL / MariaDB / older SQLite: insert then read back by id.
    // Callers always supply ids for bulk inserts so the WHERE IN is exact.
    await this.delegate.createMany({ data: rows });
    const ids = data.map((d) => d.id).filter(Boolean) as Id[];
    return this.find({ where: { id: { in: ids } } as unknown as Where<T> });
  }

  async update(id: Id, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    return this.row(
      await this.delegate.update({
        where: { id },
        data: toDbData(patch as Record<string, unknown>, this.fields),
      }),
    );
  }

  async updateMany(
    where: Where<T>,
    patch: Partial<Omit<T, 'id'>>,
  ): Promise<number> {
    const res = await this.delegate.updateMany({
      where: toPrismaWhere(where, this.fields),
      data: toDbData(patch as Record<string, unknown>, this.fields),
    });
    return res.count;
  }

  async delete(id: Id): Promise<void> {
    await this.delegate.delete({ where: { id } });
  }

  async deleteMany(where: Where<T>): Promise<number> {
    const res = await this.delegate.deleteMany({
      where: toPrismaWhere(where, this.fields),
    });
    return res.count;
  }
}
