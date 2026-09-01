/**
 * Loads the demo dataset into a real Postgres database.
 *
 *   npm run db:push && npm run db:seed
 *
 * It reuses `buildSeed()` — the same generator the in-memory provider uses —
 * so there is one definition of the demo data rather than two that drift.
 * The only work here is translating it for Prisma: ISO strings become Date
 * objects, and rows are inserted parents-first to satisfy foreign keys.
 *
 * Running it twice is safe: every table is cleared first.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { buildSeed } from '../src/lib/data/memory/seed';

// Prisma 7 talks to the database through a driver adapter rather than its own
// engine. Seeding uses the *direct* connection when there is one: it writes
// tens of thousands of rows in a handful of long transactions, which is the
// one workload a connection pooler handles worst.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    'Set DATABASE_URL (and DIRECT_URL, if your host has a pooler) before seeding.',
  );
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** `2026-08-31` → a Date at UTC midnight, for a `@db.Date` column. */
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const dayOrNull = (value: string | null) => (value ? day(value) : null);
/** An ISO timestamp → Date, for a `DateTime` column. */
const at = (value: string) => new Date(value);
const atOrNull = (value: string | null) => (value ? at(value) : null);

/**
 * Prisma's `Json` input type only accepts values with a string index
 * signature, which a declared interface never has — so a typed array of
 * plain objects has to be handed over as JSON explicitly. The value really
 * is JSON-serialisable; only the type needs the nudge.
 */
const json = <T>(value: T) => value as Prisma.InputJsonValue;

/** Inserts in batches so a large visit table does not blow the query size. */
async function insertMany<T>(
  label: string,
  rows: T[],
  create: (batch: T[]) => Promise<unknown>,
  batchSize = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    await create(rows.slice(i, i + batchSize));
  }
  process.stdout.write(`  ${String(rows.length).padStart(6)}  ${label}\n`);
}

async function main() {
  const db = buildSeed();

  process.stdout.write('Clearing existing rows…\n');
  // Children first, so foreign keys never block a delete.
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.stockIssue.deleteMany(),
    prisma.purchaseRequest.deleteMany(),
    prisma.stockLevel.deleteMany(),
    prisma.inventoryItem.deleteMany(),
    prisma.complaint.deleteMany(),
    prisma.staffPayout.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.washVisit.deleteMany(),
    prisma.car.deleteMany(),
    prisma.servicePackage.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.pocketMoneyRequest.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.staff.deleteMany(),
    prisma.area.deleteMany(),
    prisma.region.deleteMany(),
    prisma.userCredential.deleteMany(),
    prisma.user.deleteMany(),
    prisma.appSettings.deleteMany(),
    prisma.payoutSettings.deleteMany(),
    prisma.enquiry.deleteMany(),
    prisma.siteContent.deleteMany(),
  ]);

  process.stdout.write('Inserting:\n');

  await insertMany('regions', db.regions, (batch) =>
    prisma.region.createMany({
      data: batch.map((r) => ({ ...r, createdAt: at(r.createdAt) })),
    }),
  );

  await insertMany('areas', db.areas, (batch) =>
    prisma.area.createMany({
      data: batch.map((a) => ({ ...a, createdAt: at(a.createdAt) })),
    }),
  );

  await insertMany('users', db.users, (batch) =>
    prisma.user.createMany({
      data: batch.map((u) => ({ ...u, createdAt: at(u.createdAt) })),
    }),
  );

  await insertMany('credentials', db.credentials, (batch) =>
    prisma.userCredential.createMany({ data: batch }),
  );

  await insertMany('staff', db.staff, (batch) =>
    prisma.staff.createMany({
      data: batch.map((s) => ({ ...s, joinedOn: day(s.joinedOn) })),
    }),
  );

  await insertMany('attendance', db.attendance, (batch) =>
    prisma.attendance.createMany({
      data: batch.map((a) => ({
        ...a,
        date: day(a.date),
        loginAt: atOrNull(a.loginAt),
      })),
    }),
  );

  await insertMany('pocket money requests', db.pocketRequests, (batch) =>
    prisma.pocketMoneyRequest.createMany({
      data: batch.map((p) => ({
        ...p,
        requestedAt: at(p.requestedAt),
        decidedAt: atOrNull(p.decidedAt),
      })),
    }),
  );

  await insertMany('packages', db.packages, (batch) =>
    prisma.servicePackage.createMany({ data: batch }),
  );

  await insertMany('customers', db.customers, (batch) =>
    prisma.customer.createMany({
      data: batch.map((c) => ({
        ...c,
        joinedOn: day(c.joinedOn),
        holdUntil: dayOrNull(c.holdUntil),
      })),
    }),
  );

  await insertMany('cars', db.cars, (batch) =>
    prisma.car.createMany({ data: batch }),
  );

  await insertMany('wash visits', db.visits, (batch) =>
    prisma.washVisit.createMany({
      data: batch.map((v) => ({
        ...v,
        scheduledDate: day(v.scheduledDate),
        startedAt: atOrNull(v.startedAt),
        completedAt: atOrNull(v.completedAt),
      })),
    }),
  );

  await insertMany('payments', db.payments, (batch) =>
    prisma.payment.createMany({
      data: batch.map((p) => ({ ...p, createdAt: at(p.createdAt) })),
    }),
  );

  await insertMany('invoices', db.invoices, (batch) =>
    prisma.invoice.createMany({
      data: batch.map((i) => ({
        ...i,
        dueOn: day(i.dueOn),
        createdAt: at(i.createdAt),
      })),
    }),
  );

  await insertMany('expenses', db.expenses, (batch) =>
    prisma.expense.createMany({
      data: batch.map((e) => ({ ...e, createdAt: at(e.createdAt) })),
    }),
  );

  await insertMany('complaints', db.complaints, (batch) =>
    prisma.complaint.createMany({
      data: batch.map((c) => ({
        ...c,
        createdAt: at(c.createdAt),
        resolvedAt: atOrNull(c.resolvedAt),
      })),
    }),
  );

  await insertMany('inventory items', db.inventoryItems, (batch) =>
    prisma.inventoryItem.createMany({ data: batch }),
  );

  await insertMany('stock levels', db.stockLevels, (batch) =>
    prisma.stockLevel.createMany({
      data: batch.map((s) => ({ ...s, updatedAt: at(s.updatedAt) })),
    }),
  );

  await insertMany('purchase requests', db.purchaseRequests, (batch) =>
    prisma.purchaseRequest.createMany({
      data: batch.map((p) => ({
        ...p,
        neededBy: day(p.neededBy),
        createdAt: at(p.createdAt),
        decidedAt: atOrNull(p.decidedAt),
      })),
    }),
  );

  await insertMany('stock issues', db.stockIssues, (batch) =>
    prisma.stockIssue.createMany({
      data: batch.map((i) => ({ ...i, createdAt: at(i.createdAt) })),
    }),
  );

  await insertMany('website enquiries', db.enquiries, (batch) =>
    prisma.enquiry.createMany({
      data: batch.map((e) => ({
        ...e,
        createdAt: at(e.createdAt),
        handledAt: atOrNull(e.handledAt),
      })),
    }),
  );

  // Singletons.
  await prisma.appSettings.create({ data: db.appSettings });
  await prisma.payoutSettings.create({ data: db.payoutSettings });
  await prisma.siteContent.create({
    data: {
      ...db.siteContent,
      updatedAt: at(db.siteContent.updatedAt),
      stats: json(db.siteContent.stats),
      howSteps: json(db.siteContent.howSteps),
      features: json(db.siteContent.features),
      testimonials: json(db.siteContent.testimonials),
      gallery: json(db.siteContent.gallery),
    },
  });
  process.stdout.write('       3  settings rows\n');

  process.stdout.write(
    `\nDone. Sign in as owner@carzz.app / owner123 with DATA_PROVIDER=prisma.\n`,
  );
}

main()
  .catch((error) => {
    process.stderr.write(`\nSeed failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
