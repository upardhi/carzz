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
  process.stdout.write(`Keeping ${admins.length} SUPER_ADMIN user(s): ${admins.map((a) => a.email || a.name).join(', ')}\n\n`);

  // First, sever any foreign key links on admin users so parent tables can be deleted later.
  await prisma.user.updateMany({
    where: { id: { in: adminIds } },
    data: { regionId: null, areaId: null, customerId: null, staffId: null },
  });
  process.stdout.write('  cleared dangling references on SUPER_ADMIN accounts\n');

  // Delete children before parents to satisfy FK constraints.
  const deletions: Array<{ name: string; run: () => Promise<{ count: number }> }> = [
    { name: 'notification', run: () => prisma.notification.deleteMany({}) },
    { name: 'customerRequest', run: () => prisma.customerRequest.deleteMany({}) },
    { name: 'staffReferral', run: () => prisma.staffReferral.deleteMany({}) },
    { name: 'stockIssue', run: () => prisma.stockIssue.deleteMany({}) },
    { name: 'purchaseRequest', run: () => prisma.purchaseRequest.deleteMany({}) },
    { name: 'stockLevel', run: () => prisma.stockLevel.deleteMany({}) },
    { name: 'inventoryItem', run: () => prisma.inventoryItem.deleteMany({}) },
    { name: 'complaint', run: () => prisma.complaint.deleteMany({}) },
    { name: 'staffPayout', run: () => prisma.staffPayout.deleteMany({}) },
    { name: 'expense', run: () => prisma.expense.deleteMany({}) },
    { name: 'washVisit', run: () => prisma.washVisit.deleteMany({}) },
    { name: 'invoice', run: () => prisma.invoice.deleteMany({}) },
    { name: 'payment', run: () => prisma.payment.deleteMany({}) },
    { name: 'car', run: () => prisma.car.deleteMany({}) },
    { name: 'customer', run: () => prisma.customer.deleteMany({}) },
    { name: 'staffLeave', run: () => prisma.staffLeave.deleteMany({}) },
    { name: 'pocketMoneyRequest', run: () => prisma.pocketMoneyRequest.deleteMany({}) },
    { name: 'attendance', run: () => prisma.attendance.deleteMany({}) },
    { name: 'staff', run: () => prisma.staff.deleteMany({}) },
    {
      name: 'userCredential',
      run: () => prisma.userCredential.deleteMany({ where: { userId: { notIn: adminIds } } }),
    },
    {
      name: 'user',
      run: () => prisma.user.deleteMany({ where: { id: { notIn: adminIds } } }),
    },
    { name: 'area', run: () => prisma.area.deleteMany({}) },
    { name: 'region', run: () => prisma.region.deleteMany({}) },
    { name: 'enquiry', run: () => prisma.enquiry.deleteMany({}) },
    { name: 'servicePackage', run: () => prisma.servicePackage.deleteMany({}) },
    { name: 'appSettings', run: () => prisma.appSettings.deleteMany({}) },
    { name: 'payoutSettings', run: () => prisma.payoutSettings.deleteMany({}) },
    { name: 'siteContent', run: () => prisma.siteContent.deleteMany({}) },
  ];

  for (const del of deletions) {
    const result = await del.run();
    process.stdout.write(`  deleted ${result.count} rows from ${del.name}\n`);
  }

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
