/**
 * Destructive reset: deletes ALL data except SUPER_ADMIN users (and their
 * credentials). Run with: npx tsx prisma/reset-to-admin.ts
 */
import { createPrismaClient } from './client';

const prisma = createPrismaClient();

async function main() {
  const admins = await prisma.user.findMany({ where: { role: 'SUPER_ADMIN' } });
  if (admins.length === 0) {
    throw new Error('No SUPER_ADMIN user found — aborting to avoid locking everyone out.');
  }
  const adminIds = admins.map((a) => a.id);
  process.stdout.write(`Keeping ${admins.length} SUPER_ADMIN user(s): ${admins.map((a) => a.email).join(', ')}\n`);

  // Delete children before parents to satisfy FK constraints.
  const deletions: Array<() => Promise<{ count: number }>> = [
    () => prisma.notification.deleteMany({}),
    () => prisma.stockIssue.deleteMany({}),
    () => prisma.purchaseRequest.deleteMany({}),
    () => prisma.stockLevel.deleteMany({}),
    () => prisma.inventoryItem.deleteMany({}),
    () => prisma.complaint.deleteMany({}),
    () => prisma.staffPayout.deleteMany({}),
    () => prisma.expense.deleteMany({}),
    () => prisma.invoice.deleteMany({}),
    () => prisma.payment.deleteMany({}),
    () => prisma.washVisit.deleteMany({}),
    () => prisma.car.deleteMany({}),
    () => prisma.customer.deleteMany({}),
    () => prisma.staffLeave.deleteMany({}),
    () => prisma.pocketMoneyRequest.deleteMany({}),
    () => prisma.attendance.deleteMany({}),
    () => prisma.staff.deleteMany({}),
    () => prisma.userCredential.deleteMany({ where: { userId: { notIn: adminIds } } }),
    () => prisma.user.deleteMany({ where: { id: { notIn: adminIds } } }),
    () => prisma.area.deleteMany({}),
    () => prisma.region.deleteMany({}),
    () => prisma.enquiry.deleteMany({}),
    () => prisma.servicePackage.deleteMany({}),
    () => prisma.appSettings.deleteMany({}),
    () => prisma.payoutSettings.deleteMany({}),
    () => prisma.siteContent.deleteMany({}),
  ];

  for (const del of deletions) {
    const result = await del();
    process.stdout.write(`  deleted ${result.count} rows\n`);
  }

  // Clean up any dangling regionId/areaId/customerId/staffId references on the admin users.
  await prisma.user.updateMany({
    where: { id: { in: adminIds } },
    data: { regionId: null, areaId: null, customerId: null, staffId: null },
  });

  process.stdout.write('\nDatabase reset complete. Only SUPER_ADMIN user(s) remain.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
