import type { DataStore } from '../ports/store';
import { MemoryStore } from '../memory/store';
import type {
  AppSettings,
  Area,
  Attendance,
  Car,
  Complaint,
  Customer,
  Enquiry,
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
  SiteContent,
  Staff,
  StaffLeave,
  StaffPayout,
  StaffReferral,
  StockIssue,
  StockLevel,
  User,
  UserCredential,
  WashVisit,
} from '../types';
import { DATE_FIELDS } from './fields';
import {
  PrismaRepository,
  fromDbRow,
  toDbData,
  type PrismaDelegate,
} from './repository';

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
  staffLeave: PrismaDelegate;
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
  enquiry: PrismaDelegate;
  staffReferral: PrismaDelegate;
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
  siteContent: SingletonDelegate;
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
  readonly leaves;
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
  readonly enquiries;
  readonly staffReferrals;

  private readonly fallbackStore: MemoryStore;

  constructor(
    private readonly prisma: PrismaClientLike,
    fallback?: MemoryStore,
  ) {
    this.fallbackStore = fallback ?? new MemoryStore();

    this.users = new PrismaRepository<User>(prisma.user, DATE_FIELDS.user, this.fallbackStore.users);
    this.regions = new PrismaRepository<Region>(prisma.region, DATE_FIELDS.region, this.fallbackStore.regions);
    this.areas = new PrismaRepository<Area>(prisma.area, DATE_FIELDS.area, this.fallbackStore.areas);
    this.staff = new PrismaRepository<Staff>(prisma.staff, DATE_FIELDS.staff, this.fallbackStore.staff);
    this.attendance = new PrismaRepository<Attendance>(prisma.attendance, DATE_FIELDS.attendance, this.fallbackStore.attendance);
    this.pocketRequests = new PrismaRepository<PocketMoneyRequest>(prisma.pocketMoneyRequest, DATE_FIELDS.pocketMoneyRequest, this.fallbackStore.pocketRequests);
    this.leaves = new PrismaRepository<StaffLeave>(prisma.staffLeave, DATE_FIELDS.staffLeave, this.fallbackStore.leaves);
    this.customers = new PrismaRepository<Customer>(prisma.customer, DATE_FIELDS.customer, this.fallbackStore.customers);
    this.cars = new PrismaRepository<Car>(prisma.car, DATE_FIELDS.car, this.fallbackStore.cars);
    this.packages = new PrismaRepository<ServicePackage>(prisma.servicePackage, DATE_FIELDS.servicePackage, this.fallbackStore.packages);
    this.visits = new PrismaRepository<WashVisit>(prisma.washVisit, DATE_FIELDS.washVisit, this.fallbackStore.visits);

    this.payments = new PrismaRepository<Payment>(prisma.payment, DATE_FIELDS.payment, this.fallbackStore.payments);
    this.invoices = new PrismaRepository<Invoice>(prisma.invoice, DATE_FIELDS.invoice, this.fallbackStore.invoices);
    this.expenses = new PrismaRepository<Expense>(prisma.expense, DATE_FIELDS.expense, this.fallbackStore.expenses);
    this.payouts = new PrismaRepository<StaffPayout>(prisma.staffPayout, DATE_FIELDS.staffPayout, this.fallbackStore.payouts);
    this.complaints = new PrismaRepository<Complaint>(prisma.complaint, DATE_FIELDS.complaint, this.fallbackStore.complaints);
    this.inventoryItems = new PrismaRepository<InventoryItem>(prisma.inventoryItem, DATE_FIELDS.inventoryItem, this.fallbackStore.inventoryItems);
    this.stockLevels = new PrismaRepository<StockLevel>(prisma.stockLevel, DATE_FIELDS.stockLevel, this.fallbackStore.stockLevels);
    this.purchaseRequests = new PrismaRepository<PurchaseRequest>(prisma.purchaseRequest, DATE_FIELDS.purchaseRequest, this.fallbackStore.purchaseRequests);
    this.stockIssues = new PrismaRepository<StockIssue>(prisma.stockIssue, DATE_FIELDS.stockIssue, this.fallbackStore.stockIssues);
    this.notifications = new PrismaRepository<Notification>(prisma.notification, DATE_FIELDS.notification, this.fallbackStore.notifications);
    this.enquiries = new PrismaRepository<Enquiry>(prisma.enquiry, DATE_FIELDS.enquiry, this.fallbackStore.enquiries);
    this.staffReferrals = new PrismaRepository<StaffReferral>(prisma.staffReferral, DATE_FIELDS.staffReferral, this.fallbackStore.staffReferrals);
  }

  async getCredential(userId: Id): Promise<UserCredential | null> {
    try {
      return ((await this.prisma.userCredential.findUnique({
        where: { userId },
      })) as UserCredential) ?? null;
    } catch {
      return this.fallbackStore.getCredential(userId);
    }
  }

  async setCredential(userId: Id, passwordHash: string): Promise<void> {
    try {
      await this.prisma.userCredential.upsert({
        where: { userId },
        create: { userId, passwordHash },
        update: { passwordHash },
      });
    } catch {
      await this.fallbackStore.setCredential(userId, passwordHash);
    }
  }

  async getAppSettings(): Promise<AppSettings> {
    try {
      const row = await this.prisma.appSettings.findUnique({
        where: { id: 'default' },
      });
      if (!row) return this.fallbackStore.getAppSettings();
      return fromDbRow<AppSettings>(row, DATE_FIELDS.appSettings);
    } catch {
      return this.fallbackStore.getAppSettings();
    }
  }

  async saveAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getAppSettings();
    const next = { ...current, ...patch, id: 'default' as const };
    const row = toDbData(next, DATE_FIELDS.appSettings);
    try {
      await this.prisma.appSettings.upsert({
        where: { id: 'default' },
        create: row,
        update: row,
      });
    } catch {
      await this.fallbackStore.saveAppSettings(patch);
    }
    return next;
  }

  async getPayoutSettings(): Promise<PayoutSettings> {
    try {
      const row = await this.prisma.payoutSettings.findUnique({
        where: { id: 'default' },
      });
      if (!row) return this.fallbackStore.getPayoutSettings();
      return fromDbRow<PayoutSettings>(row, DATE_FIELDS.payoutSettings);
    } catch {
      return this.fallbackStore.getPayoutSettings();
    }
  }

  async savePayoutSettings(
    patch: Partial<PayoutSettings>,
  ): Promise<PayoutSettings> {
    const current = await this.getPayoutSettings();
    const next = { ...current, ...patch, id: 'default' as const };
    const row = toDbData(next, DATE_FIELDS.payoutSettings);
    try {
      await this.prisma.payoutSettings.upsert({
        where: { id: 'default' },
        create: row,
        update: row,
      });
    } catch {
      await this.fallbackStore.savePayoutSettings(patch);
    }
    return next;
  }

  async getSiteContent(): Promise<SiteContent> {
    try {
      const row = await this.prisma.siteContent.findUnique({
        where: { id: 'default' },
      });
      if (!row) return this.fallbackStore.getSiteContent();
      return fromDbRow<SiteContent>(row, DATE_FIELDS.siteContent);
    } catch {
      return this.fallbackStore.getSiteContent();
    }
  }

  async saveSiteContent(patch: Partial<SiteContent>): Promise<SiteContent> {
    const next = {
      ...(await this.getSiteContent()),
      ...patch,
      id: 'default' as const,
      updatedAt: new Date().toISOString(),
    };
    const row = toDbData(next, DATE_FIELDS.siteContent);
    try {
      await this.prisma.siteContent.upsert({
        where: { id: 'default' },
        create: row,
        update: row,
      });
    } catch {
      await this.fallbackStore.saveSiteContent(patch);
    }
    return next;
  }

  async transaction<R>(fn: (store: DataStore) => Promise<R>): Promise<R> {
    try {
      return await this.prisma.$transaction((tx) => fn(new PrismaStore(tx, this.fallbackStore)));
    } catch {
      return fn(this.fallbackStore);
    }
  }
}
