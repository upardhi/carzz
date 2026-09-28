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
 * This CLEARS every table first (atomically), so run it only against a database you are
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

  const passwordHash = await hashPassword(adminPassword);

  // One transaction: if anything below fails, nothing is deleted, so a failed
  // run can never leave the database without its admin.
  await prisma.$transaction(
    async (tx) => {
      process.stdout.write('Clearing every table…\n');
      // Read from the catalogue rather than listed by hand, so a table added
      // to the schema later is cleared too instead of blocking on its keys.
      const tables = await tx.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables
        WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
      if (tables.length > 0) {
        const list = tables
          .map((t) => `"${t.tablename.replace(/"/g, '""')}"`)
          .join(', ');
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
      }
      process.stdout.write(`  ${tables.length} tables cleared\n`);

      process.stdout.write('Bootstrapping production configuration…\n');

      // 1. Packages
      await tx.servicePackage.createMany({
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
      await tx.appSettings.create({
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

      await tx.payoutSettings.create({
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

      await tx.siteContent.create({
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
      const adminUser = await tx.user.create({
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

      await tx.userCredential.create({
        data: {
          userId: adminUser.id,
          passwordHash,
        },
      });
    },
    { timeout: 60_000 },
  );

  process.stdout.write(
    `\nProduction bootstrap complete! Super Admin created:\n  Email:    ${adminEmail}\n  Password: ${adminPassword}\n`,
  );
}
