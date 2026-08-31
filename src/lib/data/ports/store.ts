import type { Repository } from './repository';
import type {
  Area,
  Attendance,
  AppSettings,
  Car,
  Complaint,
  Customer,
  Expense,
  Id,
  InventoryItem,
  Invoice,
  Notification,
  Payment,
  PayoutSettings,
  PocketMoneyRequest,
  PurchaseRequest,
  Region,
  ServicePackage,
  Staff,
  StaffPayout,
  StockIssue,
  StockLevel,
  User,
  UserCredential,
  WashVisit,
} from '../types';

/**
 * Everything the application is allowed to ask of persistence.
 *
 * Route handlers and services depend on this interface only. Swapping
 * `DATA_PROVIDER` swaps the implementation underneath without touching a
 * single caller — that is the whole point of this seam.
 */
export interface DataStore {
  readonly users: Repository<User>;
  readonly regions: Repository<Region>;
  readonly areas: Repository<Area>;
  readonly staff: Repository<Staff>;
  readonly attendance: Repository<Attendance>;
  readonly pocketRequests: Repository<PocketMoneyRequest>;
  readonly customers: Repository<Customer>;
  readonly cars: Repository<Car>;
  readonly packages: Repository<ServicePackage>;
  readonly visits: Repository<WashVisit>;
  readonly payments: Repository<Payment>;
  readonly invoices: Repository<Invoice>;
  readonly expenses: Repository<Expense>;
  readonly payouts: Repository<StaffPayout>;
  readonly complaints: Repository<Complaint>;
  readonly inventoryItems: Repository<InventoryItem>;
  readonly stockLevels: Repository<StockLevel>;
  readonly purchaseRequests: Repository<PurchaseRequest>;
  readonly stockIssues: Repository<StockIssue>;
  readonly notifications: Repository<Notification>;

  /** Credentials are kept apart so a password hash never rides on a `User`. */
  getCredential(userId: Id): Promise<UserCredential | null>;
  setCredential(userId: Id, passwordHash: string): Promise<void>;

  /** Singletons. */
  getAppSettings(): Promise<AppSettings>;
  saveAppSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
  getPayoutSettings(): Promise<PayoutSettings>;
  savePayoutSettings(patch: Partial<PayoutSettings>): Promise<PayoutSettings>;

  /**
   * Runs `fn` atomically where the backend supports it. The memory adapter
   * runs it directly; callers must therefore keep transactional work small and
   * idempotent rather than relying on rollback.
   */
  transaction<R>(fn: (store: DataStore) => Promise<R>): Promise<R>;
}
