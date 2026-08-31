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
import { PrismaRepository, type PrismaDelegate } from './repository';

/**
 * The shape of a generated `PrismaClient` this adapter relies on. Typing it
 * structurally means the project compiles and runs on the memory provider
 * without `@prisma/client` installed; install it and run `prisma generate`
 * when you switch `DATA_PROVIDER=prisma`.
 */
export interface PrismaClientLike {
  user: PrismaDelegate;
  region: PrismaDelegate;
  area: PrismaDelegate;
  staff: PrismaDelegate;
  attendance: PrismaDelegate;
  pocketMoneyRequest: PrismaDelegate;
  customer: PrismaDelegate;
  car: PrismaDelegate;
  servicePackage: PrismaDelegate;
  washVisit: PrismaDelegate;
  payment: PrismaDelegate;
  invoice: PrismaDelegate;
  expense: PrismaDelegate;
  staffPayout: PrismaDelegate;
  complaint: PrismaDelegate;
  inventoryItem: PrismaDelegate;
  stockLevel: PrismaDelegate;
  purchaseRequest: PrismaDelegate;
  stockIssue: PrismaDelegate;
  notification: PrismaDelegate;
  userCredential: {
    findUnique(args: { where: { userId: string } }): Promise<unknown>;
    upsert(args: {
      where: { userId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
  appSettings: SingletonDelegate;
  payoutSettings: SingletonDelegate;
  $transaction<R>(fn: (tx: PrismaClientLike) => Promise<R>): Promise<R>;
}

interface SingletonDelegate {
  findUnique(args: { where: { id: string } }): Promise<unknown>;
  upsert(args: {
    where: { id: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<unknown>;
}

export class PrismaStore implements DataStore {
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

  constructor(private readonly prisma: PrismaClientLike) {
    this.users = new PrismaRepository<User>(prisma.user);
    this.regions = new PrismaRepository<Region>(prisma.region);
    this.areas = new PrismaRepository<Area>(prisma.area);
    this.staff = new PrismaRepository<Staff>(prisma.staff);
    this.attendance = new PrismaRepository<Attendance>(prisma.attendance);
    this.pocketRequests = new PrismaRepository<PocketMoneyRequest>(prisma.pocketMoneyRequest);
    this.customers = new PrismaRepository<Customer>(prisma.customer);
    this.cars = new PrismaRepository<Car>(prisma.car);
    this.packages = new PrismaRepository<ServicePackage>(prisma.servicePackage);
    this.visits = new PrismaRepository<WashVisit>(prisma.washVisit);
    this.payments = new PrismaRepository<Payment>(prisma.payment);
    this.invoices = new PrismaRepository<Invoice>(prisma.invoice);
    this.expenses = new PrismaRepository<Expense>(prisma.expense);
    this.payouts = new PrismaRepository<StaffPayout>(prisma.staffPayout);
    this.complaints = new PrismaRepository<Complaint>(prisma.complaint);
    this.inventoryItems = new PrismaRepository<InventoryItem>(prisma.inventoryItem);
    this.stockLevels = new PrismaRepository<StockLevel>(prisma.stockLevel);
    this.purchaseRequests = new PrismaRepository<PurchaseRequest>(prisma.purchaseRequest);
    this.stockIssues = new PrismaRepository<StockIssue>(prisma.stockIssue);
    this.notifications = new PrismaRepository<Notification>(prisma.notification);
  }

  async getCredential(userId: Id): Promise<UserCredential | null> {
    return ((await this.prisma.userCredential.findUnique({
      where: { userId },
    })) as UserCredential) ?? null;
  }

  async setCredential(userId: Id, passwordHash: string): Promise<void> {
    await this.prisma.userCredential.upsert({
      where: { userId },
      create: { userId, passwordHash },
      update: { passwordHash },
    });
  }

  async getAppSettings(): Promise<AppSettings> {
    const row = await this.prisma.appSettings.findUnique({
      where: { id: 'default' },
    });
    if (!row) throw new Error('App settings row missing — run the seed.');
    return row as AppSettings;
  }

  async saveAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getAppSettings();
    const next = { ...current, ...patch, id: 'default' as const };
    await this.prisma.appSettings.upsert({
      where: { id: 'default' },
      create: next,
      update: next,
    });
    return next;
  }

  async getPayoutSettings(): Promise<PayoutSettings> {
    const row = await this.prisma.payoutSettings.findUnique({
      where: { id: 'default' },
    });
    if (!row) throw new Error('Payout settings row missing — run the seed.');
    return row as PayoutSettings;
  }

  async savePayoutSettings(
    patch: Partial<PayoutSettings>,
  ): Promise<PayoutSettings> {
    const current = await this.getPayoutSettings();
    const next = { ...current, ...patch, id: 'default' as const };
    await this.prisma.payoutSettings.upsert({
      where: { id: 'default' },
      create: next,
      update: next,
    });
    return next;
  }

  async transaction<R>(fn: (store: DataStore) => Promise<R>): Promise<R> {
    return this.prisma.$transaction((tx) => fn(new PrismaStore(tx)));
  }
}
