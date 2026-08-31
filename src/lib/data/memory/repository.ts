import type {
  CreateInput,
  FindOptions,
  Repository,
  Where,
} from '../ports/repository';
import type { Id } from '../types';

let counter = 0;
export function newId(prefix = 'id'): Id {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36).padStart(3, '0')}`;
}

function isOperatorObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v as object);
  const ops = [
    'eq',
    'ne',
    'in',
    'notIn',
    'gt',
    'gte',
    'lt',
    'lte',
    'contains',
    'has',
  ];
  return keys.length > 0 && keys.every((k) => ops.includes(k));
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
}

function matchesField(value: unknown, filter: unknown): boolean {
  if (!isOperatorObject(filter)) return value === filter;

  const f = filter;
  if ('eq' in f && value !== f.eq) return false;
  if ('ne' in f && value === f.ne) return false;
  if ('in' in f && !(f.in as unknown[]).includes(value)) return false;
  if ('notIn' in f && (f.notIn as unknown[]).includes(value)) return false;
  if ('gt' in f && !(compare(value, f.gt) > 0)) return false;
  if ('gte' in f && !(compare(value, f.gte) >= 0)) return false;
  if ('lt' in f && !(compare(value, f.lt) < 0)) return false;
  if ('lte' in f && !(compare(value, f.lte) <= 0)) return false;
  if ('contains' in f) {
    const needle = String(f.contains).toLowerCase();
    if (!String(value ?? '').toLowerCase().includes(needle)) return false;
  }
  if ('has' in f) {
    if (!Array.isArray(value) || !value.includes(f.has)) return false;
  }
  return true;
}

export function matchesWhere<T>(row: T, where?: Where<T>): boolean {
  if (!where) return true;
  for (const key of Object.keys(where) as (keyof T)[]) {
    if (!matchesField(row[key], where[key])) return false;
  }
  return true;
}

/**
 * An in-process repository over a plain array.
 *
 * Rows are cloned on the way in and on the way out so callers can never mutate
 * stored state by holding on to a returned object — the same guarantee a real
 * database gives, which keeps behaviour identical when the provider changes.
 */
export class MemoryRepository<T extends { id: Id }> implements Repository<T> {
  constructor(
    private rows: T[],
    private readonly prefix: string,
  ) {}

  /** Escape hatch for the seeder and for cross-repository joins in tests. */
  all(): T[] {
    return this.rows.map(clone);
  }

  async get(id: Id): Promise<T | null> {
    const row = this.rows.find((r) => r.id === id);
    return row ? clone(row) : null;
  }

  async find(options: FindOptions<T> = {}): Promise<T[]> {
    let out = this.rows.filter((r) => matchesWhere(r, options.where));

    if (options.orderBy?.length) {
      const orders = options.orderBy;
      out = [...out].sort((a, b) => {
        for (const o of orders) {
          const dir = o.dir === 'desc' ? -1 : 1;
          const c = compare(a[o.field], b[o.field]) * dir;
          if (c !== 0) return c;
        }
        return 0;
      });
    }

    const start = options.offset ?? 0;
    const end = options.limit === undefined ? undefined : start + options.limit;
    return out.slice(start, end).map(clone);
  }

  async findOne(options: FindOptions<T> = {}): Promise<T | null> {
    const [row] = await this.find({ ...options, limit: 1 });
    return row ?? null;
  }

  async count(where?: Where<T>): Promise<number> {
    return this.rows.filter((r) => matchesWhere(r, where)).length;
  }

  async create(data: CreateInput<T>): Promise<T> {
    const row = { ...(data as object), id: data.id ?? newId(this.prefix) } as T;
    this.rows.push(clone(row));
    return clone(row);
  }

  async createMany(data: CreateInput<T>[]): Promise<T[]> {
    const out: T[] = [];
    for (const d of data) out.push(await this.create(d));
    return out;
  }

  async update(id: Id, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const index = this.rows.findIndex((r) => r.id === id);
    if (index === -1) throw new Error(`${this.prefix} ${id} not found`);
    const next = { ...this.rows[index], ...patch, id } as T;
    this.rows[index] = next;
    return clone(next);
  }

  async updateMany(
    where: Where<T>,
    patch: Partial<Omit<T, 'id'>>,
  ): Promise<number> {
    let n = 0;
    this.rows = this.rows.map((r) => {
      if (!matchesWhere(r, where)) return r;
      n += 1;
      return { ...r, ...patch, id: r.id } as T;
    });
    return n;
  }

  async delete(id: Id): Promise<void> {
    this.rows = this.rows.filter((r) => r.id !== id);
  }

  async deleteMany(where: Where<T>): Promise<number> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !matchesWhere(r, where));
    return before - this.rows.length;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
