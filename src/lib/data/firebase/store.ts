import type { DataStore } from '../ports/store';
import type {
  AppSettings,
  Area,
  Attendance,
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
import { FirestoreRepository, type FirestoreCollection } from './repository';

export interface FirestoreLike {
  collection(path: string): FirestoreCollection;
}

/** Collection names, kept in one place so a rename is a one-line change. */
export const COLLECTIONS = {
  users: 'users',
  credentials: 'userCredentials',
  regions: 'regions',
  areas: 'areas',
  staff: 'staff',
  attendance: 'attendance',
  pocketRequests: 'pocketMoneyRequests',
  customers: 'customers',
  cars: 'cars',
  packages: 'servicePackages',
  visits: 'washVisits',
  payments: 'payments',
  invoices: 'invoices',
  expenses: 'expenses',
  payouts: 'staffPayouts',
  complaints: 'complaints',
  inventoryItems: 'inventoryItems',
  stockLevels: 'stockLevels',
  purchaseRequests: 'purchaseRequests',
  stockIssues: 'stockIssues',
  notifications: 'notifications',
  settings: 'settings',
} as const;

export class FirestoreStore implements DataStore {
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

  constructor(private readonly db: FirestoreLike) {
    const c = (name: string) => db.collection(name);
    this.users = new FirestoreRepository<User>(c(COLLECTIONS.users));
    this.regions = new FirestoreRepository<Region>(c(COLLECTIONS.regions));
    this.areas = new FirestoreRepository<Area>(c(COLLECTIONS.areas));
    this.staff = new FirestoreRepository<Staff>(c(COLLECTIONS.staff));
    this.attendance = new FirestoreRepository<Attendance>(c(COLLECTIONS.attendance));
    this.pocketRequests = new FirestoreRepository<PocketMoneyRequest>(c(COLLECTIONS.pocketRequests));
    this.customers = new FirestoreRepository<Customer>(c(COLLECTIONS.customers));
    this.cars = new FirestoreRepository<Car>(c(COLLECTIONS.cars));
    this.packages = new FirestoreRepository<ServicePackage>(c(COLLECTIONS.packages));
    this.visits = new FirestoreRepository<WashVisit>(c(COLLECTIONS.visits));
    this.payments = new FirestoreRepository<Payment>(c(COLLECTIONS.payments));
    this.invoices = new FirestoreRepository<Invoice>(c(COLLECTIONS.invoices));
    this.expenses = new FirestoreRepository<Expense>(c(COLLECTIONS.expenses));
    this.payouts = new FirestoreRepository<StaffPayout>(c(COLLECTIONS.payouts));
    this.complaints = new FirestoreRepository<Complaint>(c(COLLECTIONS.complaints));
    this.inventoryItems = new FirestoreRepository<InventoryItem>(c(COLLECTIONS.inventoryItems));
    this.stockLevels = new FirestoreRepository<StockLevel>(c(COLLECTIONS.stockLevels));
    this.purchaseRequests = new FirestoreRepository<PurchaseRequest>(c(COLLECTIONS.purchaseRequests));
    this.stockIssues = new FirestoreRepository<StockIssue>(c(COLLECTIONS.stockIssues));
    this.notifications = new FirestoreRepository<Notification>(c(COLLECTIONS.notifications));
  }

  async getCredential(userId: Id): Promise<UserCredential | null> {
    const snap = await this.db.collection(COLLECTIONS.credentials).doc(userId).get();
    return snap.exists
      ? ({ ...(snap.data() as object), userId } as UserCredential)
      : null;
  }

  async setCredential(userId: Id, passwordHash: string): Promise<void> {
    await this.db
      .collection(COLLECTIONS.credentials)
      .doc(userId)
      .set({ passwordHash }, { merge: true });
  }

  private async singleton<T>(id: string, fallback: T): Promise<T> {
    const snap = await this.db.collection(COLLECTIONS.settings).doc(id).get();
    return snap.exists ? ({ ...fallback, ...(snap.data() as object) } as T) : fallback;
  }

  async getAppSettings(): Promise<AppSettings> {
    return this.singleton<AppSettings>('app', DEFAULT_APP_SETTINGS);
  }

  async saveAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = { ...(await this.getAppSettings()), ...patch, id: 'default' as const };
    await this.db.collection(COLLECTIONS.settings).doc('app').set(next, { merge: true });
    return next;
  }

  async getPayoutSettings(): Promise<PayoutSettings> {
    return this.singleton<PayoutSettings>('payout', DEFAULT_PAYOUT_SETTINGS);
  }

  async savePayoutSettings(patch: Partial<PayoutSettings>): Promise<PayoutSettings> {
    const next = { ...(await this.getPayoutSettings()), ...patch, id: 'default' as const };
    await this.db.collection(COLLECTIONS.settings).doc('payout').set(next, { merge: true });
    return next;
  }

  /**
   * Firestore transactions cannot span the ad-hoc queries these services run,
   * so the callback executes directly. Services are written to be idempotent
   * for exactly this reason.
   */
  async transaction<R>(fn: (store: DataStore) => Promise<R>): Promise<R> {
    return fn(this);
  }
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'default',
  photoRetentionMonths: 1,
  requireBothPhotos: true,
  missedWashReturnsToCount: true,
  paymentModesEnabled: ['CASH', 'MANUAL_UPI', 'GATEWAY'],
  reminderDaysBeforeDue: 3,
  reminderChannel: 'WHATSAPP',
  autoApprovePurchaseUnder: 0,
  teaBreakMinutes: 15,
  languages: ['en', 'hi', 'mr'],
};

export const DEFAULT_PAYOUT_SETTINGS: PayoutSettings = {
  id: 'default',
  baseMode: 'PER_WASH',
  perWashRate: 110,
  slabByCarIndex: [300, 350, 400],
  slabBeyond: 400,
  onTimeBonus: 10,
  goodReviewBonus: 10,
  goodReviewMinStars: 4,
  carReferralBonus: 300,
  staffReferralBonus: 1000,
  offsAllowedPerMonth: 2,
  extraOffPenalty: 300,
  uninformedLeavePenalty: 500,
  pocketWeeklyCapPercent: 25,
  pocketMinimumBalance: 1000,
};
