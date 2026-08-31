import type {
  CreateInput,
  FindOptions,
  Repository,
  Where,
} from '../ports/repository';
import type { Id } from '../types';

/** The subset of a Prisma model delegate this adapter needs. */
export interface PrismaDelegate {
  findUnique(args: { where: { id: string } }): Promise<unknown>;
  findMany(args: Record<string, unknown>): Promise<unknown[]>;
  count(args: Record<string, unknown>): Promise<number>;
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  createMany(args: { data: Record<string, unknown>[] }): Promise<unknown>;
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
 * Translates the portable filter language into Prisma's `where` shape.
 *
 * The operators line up almost exactly; the only special cases are `contains`
 * (which gets Prisma's case-insensitive mode) and `has` (array membership).
 */
export function toPrismaWhere<T>(where?: Where<T>): Record<string, unknown> {
  if (!where) return {};
  const out: Record<string, unknown> = {};

  for (const [field, filter] of Object.entries(where)) {
    if (filter === undefined) continue;
    if (filter === null || typeof filter !== 'object' || Array.isArray(filter)) {
      out[field] = filter;
      continue;
    }

    const f = filter as Record<string, unknown>;
    const clause: Record<string, unknown> = {};
    if ('eq' in f) clause.equals = f.eq;
    if ('ne' in f) clause.not = f.ne;
    if ('in' in f) clause.in = f.in;
    if ('notIn' in f) clause.notIn = f.notIn;
    if ('gt' in f) clause.gt = f.gt;
    if ('gte' in f) clause.gte = f.gte;
    if ('lt' in f) clause.lt = f.lt;
    if ('lte' in f) clause.lte = f.lte;
    if ('contains' in f) {
      clause.contains = f.contains;
      clause.mode = 'insensitive';
    }
    if ('has' in f) clause.has = f.has;

    out[field] = Object.keys(clause).length ? clause : filter;
  }

  return out;
}

export class PrismaRepository<T extends { id: Id }> implements Repository<T> {
  constructor(private readonly delegate: PrismaDelegate) {}

  async get(id: Id): Promise<T | null> {
    return ((await this.delegate.findUnique({ where: { id } })) as T) ?? null;
  }

  async find(options: FindOptions<T> = {}): Promise<T[]> {
    return (await this.delegate.findMany({
      where: toPrismaWhere(options.where),
      orderBy: options.orderBy?.map((o) => ({ [o.field]: o.dir ?? 'asc' })),
      take: options.limit,
      skip: options.offset,
    })) as T[];
  }

  async findOne(options: FindOptions<T> = {}): Promise<T | null> {
    const [row] = await this.find({ ...options, limit: 1 });
    return row ?? null;
  }

  async count(where?: Where<T>): Promise<number> {
    return this.delegate.count({ where: toPrismaWhere(where) });
  }

  async create(data: CreateInput<T>): Promise<T> {
    return (await this.delegate.create({
      data: data as Record<string, unknown>,
    })) as T;
  }

  async createMany(data: CreateInput<T>[]): Promise<T[]> {
    await this.delegate.createMany({ data: data as Record<string, unknown>[] });
    // `createMany` does not return rows on every connector, so read them back
    // by id; callers always supply ids for bulk inserts.
    const ids = data.map((d) => d.id).filter(Boolean) as Id[];
    return this.find({ where: { id: { in: ids } } as unknown as Where<T> });
  }

  async update(id: Id, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    return (await this.delegate.update({
      where: { id },
      data: patch as Record<string, unknown>,
    })) as T;
  }

  async updateMany(
    where: Where<T>,
    patch: Partial<Omit<T, 'id'>>,
  ): Promise<number> {
    const res = await this.delegate.updateMany({
      where: toPrismaWhere(where),
      data: patch as Record<string, unknown>,
    });
    return res.count;
  }

  async delete(id: Id): Promise<void> {
    await this.delegate.delete({ where: { id } });
  }

  async deleteMany(where: Where<T>): Promise<number> {
    const res = await this.delegate.deleteMany({ where: toPrismaWhere(where) });
    return res.count;
  }
}
