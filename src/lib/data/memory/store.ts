import type { DataStore } from '../ports/store';
import type { AppSettings, Id, PayoutSettings, UserCredential } from '../types';
import { MemoryRepository } from './repository';
import { buildSeed, type Db } from './seed';

/**
 * In-process implementation of {@link DataStore}.
 *
 * Data lives for the lifetime of the server process. It is the default
 * provider so the app is runnable and demonstrable with no database at all;
 * point `DATA_PROVIDER` at `prisma` or `firebase` when the real one is chosen.
 */
export class MemoryStore implements DataStore {
  readonly users;
  readonly regions;
  readonly areas;
  readonly staff;
  readonly attendance;
  readonly pocketRequests;
  readonly customers;
  readonly cars;
  readonly packages;
  readonly visits;
  readonly payments;
  readonly invoices;
  readonly expenses;
  readonly payouts;
  readonly complaints;
  readonly inventoryItems;
  readonly stockLevels;
  readonly purchaseRequests;
  readonly stockIssues;
  readonly notifications;

  private credentials: UserCredential[];
  private appSettings: AppSettings;
  private payoutSettings: PayoutSettings;

  constructor(private readonly db: Db = buildSeed()) {
    this.users = new MemoryRepository(db.users, 'usr');
    this.regions = new MemoryRepository(db.regions, 'rg');
    this.areas = new MemoryRepository(db.areas, 'ar');
    this.staff = new MemoryRepository(db.staff, 'stf');
    this.attendance = new MemoryRepository(db.attendance, 'att');
    this.pocketRequests = new MemoryRepository(db.pocketRequests, 'pkt');
    this.customers = new MemoryRepository(db.customers, 'cus');
    this.cars = new MemoryRepository(db.cars, 'car');
    this.packages = new MemoryRepository(db.packages, 'pkg');
    this.visits = new MemoryRepository(db.visits, 'vst');
    this.payments = new MemoryRepository(db.payments, 'pay');
    this.invoices = new MemoryRepository(db.invoices, 'inv');
    this.expenses = new MemoryRepository(db.expenses, 'exp');
    this.payouts = new MemoryRepository(db.payouts, 'pyt');
    this.complaints = new MemoryRepository(db.complaints, 'cmp');
    this.inventoryItems = new MemoryRepository(db.inventoryItems, 'itm');
    this.stockLevels = new MemoryRepository(db.stockLevels, 'stk');
    this.purchaseRequests = new MemoryRepository(db.purchaseRequests, 'pr');
    this.stockIssues = new MemoryRepository(db.stockIssues, 'isu');
    this.notifications = new MemoryRepository(db.notifications, 'ntf');

    this.credentials = db.credentials;
    this.appSettings = db.appSettings;
    this.payoutSettings = db.payoutSettings;
  }

  async getCredential(userId: Id): Promise<UserCredential | null> {
    return this.credentials.find((c) => c.userId === userId) ?? null;
  }

  async setCredential(userId: Id, passwordHash: string): Promise<void> {
    const existing = this.credentials.find((c) => c.userId === userId);
    if (existing) existing.passwordHash = passwordHash;
    else this.credentials.push({ userId, passwordHash });
  }

  async getAppSettings(): Promise<AppSettings> {
    return { ...this.appSettings };
  }

  async saveAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    this.appSettings = { ...this.appSettings, ...patch, id: 'default' };
    return { ...this.appSettings };
  }

  async getPayoutSettings(): Promise<PayoutSettings> {
    return { ...this.payoutSettings };
  }

  async savePayoutSettings(
    patch: Partial<PayoutSettings>,
  ): Promise<PayoutSettings> {
    this.payoutSettings = { ...this.payoutSettings, ...patch, id: 'default' };
    return { ...this.payoutSettings };
  }

  /**
   * There is no rollback here — the callback simply runs against this store.
   * Services are written to tolerate that (small, idempotent units of work),
   * which is also what keeps them correct on Firestore, whose transactions
   * carry their own constraints.
   */
  async transaction<R>(fn: (store: DataStore) => Promise<R>): Promise<R> {
    return fn(this);
  }

  /** Test/support hook: rebuild the dataset from scratch. */
  static fresh(today?: Date): MemoryStore {
    return new MemoryStore(buildSeed(today));
  }
}
