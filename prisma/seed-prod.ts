/**
 * Clean production seeder.
 *
 * Clears every table, then initializes a fresh database with only the
 * required configuration:
 *   - 1 Initial Super Admin user
 *   - Default service packages
 *   - Default application settings
 *   - Default payout settings
 *   - Default website content
 *
 * No fake customers, staff, visits, or mock data are inserted.
 *
 * This CLEARS every table first, so run it only against a database you are
 * deliberately resetting — `prisma/setup.ts`'s automatic build-time path
 * never calls this unless the database has no accounts in it yet, so a real
 * deployment's data is never touched by that path.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';
import { DEFAULT_SITE_CONTENT } from '../src/lib/data/memory/seed';

const json = <T>(value: T) => value as Prisma.InputJsonValue;

export async function seedProdData(prisma: PrismaClient): Promise<void> {
  const adminName = process.env.ADMIN_NAME || 'Super Admin';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@carzz.app').toLowerCase();
  const adminPhone = process.env.ADMIN_PHONE || '9800000001';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

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

  process.stdout.write('Bootstrapping production configuration…\n');

  // 1. Packages
  await prisma.servicePackage.createMany({
    data: [
      {
        id: 'pkg_bucket',
        name: 'Bucket Wash',
        washesPerMonth: 8,
        billingPeriod: 'MONTHLY',
        washesPerPeriod: 8,
        price: 1600,
        costToDeliver: 536,
        services: ['Exterior wash', 'Interior vacuum'],
        active: true,
      },
      {
        id: 'pkg_pressure',
        name: 'Pressure Wash',
        washesPerMonth: 8,
        billingPeriod: 'MONTHLY',
        washesPerPeriod: 8,
        price: 2000,
        costToDeliver: 712,
        services: ['Pressure wash', 'Interior vacuum', 'Tyre dressing'],
        active: true,
      },
      {
        id: 'pkg_detailing',
        name: 'Detailing',
        washesPerMonth: 4,
        billingPeriod: 'MONTHLY',
        washesPerPeriod: 4,
        price: 3200,
        costToDeliver: 1640,
        services: ['Pressure wash', 'Interior vacuum', 'Polish / wax', 'Tyre dressing'],
        active: true,
      },
    ],
  });
  process.stdout.write('  3 service packages created\n');

  // 2. Settings Singletons
  await prisma.appSettings.create({
    data: {
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
    },
  });

  await prisma.payoutSettings.create({
    data: {
      id: 'default',
      baseMode: 'PER_WASH',
      perWashRate: 110,
      slabByCarIndex: [0, 80, 160, 240, 320, 400],
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
    },
  });

  await prisma.siteContent.create({
    data: {
      ...DEFAULT_SITE_CONTENT,
      updatedAt: new Date(),
      stats: json(DEFAULT_SITE_CONTENT.stats),
      howSteps: json(DEFAULT_SITE_CONTENT.howSteps),
      features: json(DEFAULT_SITE_CONTENT.features),
      testimonials: json(DEFAULT_SITE_CONTENT.testimonials),
      gallery: json(DEFAULT_SITE_CONTENT.gallery),
    },
  });
  process.stdout.write('  Application settings and site content initialized\n');

  // 3. Super Admin
  const adminUser = await prisma.user.create({
    data: {
      id: 'usr_super_admin',
      name: adminName,
      email: adminEmail,
      phone: adminPhone,
      role: 'SUPER_ADMIN',
      language: 'en',
      active: true,
      createdAt: new Date(),
    },
  });

  const passwordHash = await hashPassword(adminPassword);
  await prisma.userCredential.create({
    data: {
      userId: adminUser.id,
      passwordHash,
    },
  });

  process.stdout.write(
    `\nProduction bootstrap complete! Super Admin created:\n  Email:    ${adminEmail}\n  Password: ${adminPassword}\n`,
  );
}
