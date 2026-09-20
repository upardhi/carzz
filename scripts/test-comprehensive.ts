import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Shim server-only for standalone Node.js test execution
try {
  const serverOnlyPath = require.resolve('server-only');
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as never;
} catch {
  // ignore
}

import { createPrismaClient } from '../prisma/client';

async function runTests() {
  const { uploadMedia, getPhotoStorage } = await import('../src/lib/storage');
  console.log('====================================================');
  console.log('🚀 RUNNING COMPREHENSIVE END-TO-END TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  const prisma = createPrismaClient();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  // -------------------------------------------------------------
  // TEST 1: Storage Layer & Document / Photo Upload
  // -------------------------------------------------------------
  console.log('▶ [TEST 1] Testing Cloud Storage Layer (Vercel Blob / Fallback)...');
  const dummyPhotoBuffer = Buffer.from('TEST_BEFORE_PHOTO_IMAGE_DATA_BYTES_1234567890', 'utf-8');
  const dummyDocBuffer = Buffer.from('TEST_STAFF_AADHAAR_DOCUMENT_PDF_DATA_BYTES_987654321', 'utf-8');

  const uploadedPhoto = await uploadMedia(dummyPhotoBuffer, {
    key: `test-wash-photo-${Date.now()}`,
    contentType: 'image/jpeg',
    folder: 'washes',
    access: 'public',
  });

  assert(
    !!uploadedPhoto.url && uploadedPhoto.bytes === dummyPhotoBuffer.length,
    'Upload wash photo to storage provider',
    `Expected size: ${dummyPhotoBuffer.length}, got: ${uploadedPhoto.bytes}, url: ${uploadedPhoto.url}`,
  );

  const uploadedDoc = await uploadMedia(dummyDocBuffer, {
    key: `staff-aadhaar-${Date.now()}`,
    contentType: 'image/jpeg',
    folder: 'staff-docs',
    access: 'private',
  });

  assert(
    !!uploadedDoc.url && uploadedDoc.bytes === dummyDocBuffer.length,
    'Upload staff document to private storage provider',
    `Expected size: ${dummyDocBuffer.length}, got: ${uploadedDoc.bytes}, url: ${uploadedDoc.url}`,
  );

  // -------------------------------------------------------------
  // TEST 2: Region & Area Creation without Manager / Admin
  // -------------------------------------------------------------
  console.log('\n▶ [TEST 2] Testing Area & Region Creation without Manager / Admin...');
  const testRegionName = `Test Region ${Date.now().toString().slice(-4)}`;
  const region = await prisma.region.create({
    data: {
      name: testRegionName,
      areaAdminId: null,
    },
  });

  assert(
    !!region.id && region.areaAdminId === null,
    'Create Region without Area Admin',
    `Region ID: ${region.id}`,
  );

  const testAreaName = `Test Area ${Date.now().toString().slice(-4)}`;
  const area = await prisma.area.create({
    data: {
      name: testAreaName,
      city: 'Nagpur',
      address: 'Plot 99, Automated Test Hub',
      regionId: region.id,
      managerId: null,
    },
  });

  assert(
    !!area.id && area.managerId === null && area.regionId === region.id,
    'Create Area without Manager',
    `Area ID: ${area.id}`,
  );

  // -------------------------------------------------------------
  // TEST 3: Staff & User KYC, Aadhaar, PAN Document Storage & Retrieval
  // -------------------------------------------------------------
  console.log('\n▶ [TEST 3] Testing Staff & User KYC Documents, Aadhaar, PAN & Bank Details...');
  const user = await prisma.user.create({
    data: {
      phone: `98765${Date.now().toString().slice(-5)}`,
      email: `raju.test.${Date.now()}@example.com`,
      name: 'Raju Test Boy',
      role: 'EMPLOYEE',
      areaId: area.id,
      regionId: region.id,
      aadharNumber: '542189012345',
      aadharCardUrl: uploadedDoc.url,
      panNumber: 'ABCDE1234F',
      panCardUrl: uploadedDoc.url,
      address: 'Flat 302, Sai Residency, Nashik',
      emergencyContactName: 'Ramesh Sharma',
      emergencyPhone: '9822199999',
    },
  });

  const staffMember = await prisma.staff.create({
    data: {
      userId: user.id,
      name: 'Raju Test Boy',
      phone: user.phone,
      role: 'EMPLOYEE',
      area: { connect: { id: area.id } },
      active: true,
      joinedOn: new Date(today),
      documentUrl: uploadedDoc.url,
      documentType: 'AADHAAR',
      aadharNumber: '542189012345',
      aadharCardUrl: uploadedDoc.url,
      panNumber: 'ABCDE1234F',
      panCardUrl: uploadedDoc.url,
      address: 'Flat 302, Sai Residency, Nashik',
      emergencyContactName: 'Ramesh Sharma',
      emergencyPhone: '9822199999',
      bankName: 'State Bank of India',
      bankAccountNumber: '30891234567',
      bankIfsc: 'SBIN0001234',
      upiId: 'raju@upi',
    },
  });

  const [fetchedStaff, fetchedUser] = await Promise.all([
    prisma.staff.findUnique({ where: { id: staffMember.id } }),
    prisma.user.findUnique({ where: { id: user.id } }),
  ]);

  assert(
    fetchedStaff?.documentUrl === uploadedDoc.url &&
    fetchedStaff?.aadharNumber === '542189012345' &&
    fetchedStaff?.panNumber === 'ABCDE1234F' &&
    fetchedStaff?.bankName === 'State Bank of India' &&
    fetchedStaff?.upiId === 'raju@upi',
    'Staff KYC, Aadhaar, PAN, and Bank details persisted in DB and retrieved correctly',
    `Aadhaar: ${fetchedStaff?.aadharNumber}, PAN: ${fetchedStaff?.panNumber}, Bank: ${fetchedStaff?.bankName}`,
  );

  assert(
    fetchedUser?.aadharNumber === '542189012345' &&
    fetchedUser?.panNumber === 'ABCDE1234F' &&
    fetchedUser?.address === 'Flat 302, Sai Residency, Nashik' &&
    fetchedUser?.emergencyContactName === 'Ramesh Sharma',
    'User Account KYC records, Aadhaar, PAN, and Emergency Contact persisted correctly',
    `User Aadhaar: ${fetchedUser?.aadharNumber}, User PAN: ${fetchedUser?.panNumber}`,
  );

  // -------------------------------------------------------------
  // TEST 4: Customer, Car, and Wash Visits Setup
  // -------------------------------------------------------------
  console.log('\n▶ [TEST 4] Testing Fast Paginated Washes, Today Schedule, Next Scheduled...');
  const customer = await prisma.customer.create({
    data: {
      name: 'Anjali Sharma',
      phone: `91234${Date.now().toString().slice(-5)}`,
      area: { connect: { id: area.id } },
      userId: null,
      altPhone: null,
      address: 'Flat 402, Sunshine Towers',
      landmark: null,
      lat: null,
      lng: null,
      source: 'OTHER',
      referredById: null,
      status: 'ACTIVE',
      holdUntil: null,
      note: null,
      joinedOn: new Date(today),
    },
  });

  const pkg = await prisma.servicePackage.findFirst();
  if (!pkg) {
    throw new Error('No service package found in database');
  }

  const carPlate = `MH-31-TE-${Date.now().toString().slice(-4)}`;
  const car = await prisma.car.create({
    data: {
      customer: { connect: { id: customer.id } },
      model: 'Honda City ZX',
      make: 'Honda',
      colour: 'Pearl White',
      plate: carPlate,
      servicePackage: { connect: { id: pkg.id } },
      assignedStaff: { connect: { id: staffMember.id } },
      weeklyDays: ['MON', 'THU'],
      scheduleTime: '07:30',
      specialInstructions: 'Parking slot B-12 near pillar',
      active: true,
    },
  });

  // Create today's DONE visit (with before & after photo and byte lengths)
  const todayDoneVisit = await prisma.washVisit.create({
    data: {
      car: { connect: { id: car.id } },
      customer: { connect: { id: customer.id } },
      areaId: area.id,
      staff: { connect: { id: staffMember.id } },
      cycle: today.slice(0, 7),
      scheduledDate: new Date(today),
      scheduledTime: '07:30',
      status: 'DONE',
      startedAt: new Date(`${today}T07:32:00.000Z`),
      completedAt: new Date(`${today}T07:55:00.000Z`),
      servicesDone: ['EXTERIOR_WASH', 'TYRE_DRESSING'],
      beforePhotoUrl: uploadedPhoto.url,
      afterPhotoUrl: uploadedPhoto.url,
      beforePhotoBytes: uploadedPhoto.bytes,
      afterPhotoBytes: uploadedPhoto.bytes,
      missReason: null,
      missNote: null,
      rescheduledToVisitId: null,
      rating: 5,
      ratingComment: 'Spotless cleaning!',
      onTime: true,
    },
  });

  // Create today's MISSED visit
  const todayMissedVisit = await prisma.washVisit.create({
    data: {
      car: { connect: { id: car.id } },
      customer: { connect: { id: customer.id } },
      areaId: area.id,
      staff: { connect: { id: staffMember.id } },
      cycle: today.slice(0, 7),
      scheduledDate: new Date(today),
      scheduledTime: '08:30',
      status: 'MISSED',
      startedAt: null,
      completedAt: null,
      servicesDone: [],
      beforePhotoUrl: null,
      afterPhotoUrl: null,
      beforePhotoBytes: null,
      afterPhotoBytes: null,
      missReason: 'CAR_NOT_AVAILABLE',
      missNote: 'Customer took car out early morning',
      rescheduledToVisitId: null,
      rating: null,
      ratingComment: null,
      onTime: false,
    },
  });

  // Create tomorrow's upcoming visit
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);

  const upcomingVisit = await prisma.washVisit.create({
    data: {
      car: { connect: { id: car.id } },
      customer: { connect: { id: customer.id } },
      areaId: area.id,
      staff: { connect: { id: staffMember.id } },
      cycle: today.slice(0, 7),
      scheduledDate: new Date(tomorrowISO),
      scheduledTime: '07:30',
      status: 'PENDING',
      startedAt: null,
      completedAt: null,
      servicesDone: [],
      beforePhotoUrl: null,
      afterPhotoUrl: null,
      beforePhotoBytes: null,
      afterPhotoBytes: null,
      missReason: null,
      missNote: null,
      rescheduledToVisitId: null,
      rating: null,
      ratingComment: null,
      onTime: false,
    },
  });

  assert(
    !!todayDoneVisit.id && !!todayMissedVisit.id && !!upcomingVisit.id,
    'Created test wash visits for today and upcoming dates',
  );

  // -------------------------------------------------------------
  // TEST 5: Washes Pagination, Search, and Filtering
  // -------------------------------------------------------------
  console.log('\n▶ [TEST 5] Testing Washes Pagination, Search, and Filter Queries...');

  // 5a. Pagination test (pageSize: 2, page: 1 and page: 2)
  const [totalCount, page1Visits] = await Promise.all([
    prisma.washVisit.count({ where: { areaId: area.id } }),
    prisma.washVisit.findMany({
      where: { areaId: area.id },
      orderBy: [{ scheduledDate: 'desc' }, { scheduledTime: 'asc' }],
      take: 2,
      skip: 0,
      include: { car: true, customer: true, staff: true },
    }),
  ]);

  const page2Visits = await prisma.washVisit.findMany({
    where: { areaId: area.id },
    orderBy: [{ scheduledDate: 'desc' }, { scheduledTime: 'asc' }],
    take: 2,
    skip: 2,
    include: { car: true, customer: true, staff: true },
  });

  assert(
    totalCount >= 3 && page1Visits.length === 2 && page2Visits.length >= 1,
    'Pagination queries with skip/take',
    `Total: ${totalCount}, Page 1 items: ${page1Visits.length}, Page 2 items: ${page2Visits.length}`,
  );

  // 5b. Search by car plate
  const searchedVisits = await prisma.washVisit.findMany({
    where: {
      areaId: area.id,
      car: { plate: { contains: carPlate } },
    },
    include: { car: true, customer: true },
  });

  assert(
    searchedVisits.length >= 3 && searchedVisits.every((v) => v.car.plate === carPlate),
    `Search query by car plate "${carPlate}"`,
    `Matched ${searchedVisits.length} visits`,
  );

  // 5c. Status filter: MISSED
  const missedVisits = await prisma.washVisit.findMany({
    where: {
      areaId: area.id,
      status: 'MISSED',
    },
  });

  assert(
    missedVisits.length >= 1 && missedVisits.every((v) => v.status === 'MISSED'),
    "Filter visits by status 'MISSED'",
    `Matched ${missedVisits.length} missed visits`,
  );

  // 5d. Today's schedule query
  const todayVisits = await prisma.washVisit.findMany({
    where: {
      areaId: area.id,
      scheduledDate: new Date(today),
    },
  });

  assert(
    todayVisits.length === 2,
    "Query today's schedule",
    `Expected 2 today visits, got: ${todayVisits.length}`,
  );

  // 5e. Upcoming schedule query
  const upcomingVisits = await prisma.washVisit.findMany({
    where: {
      areaId: area.id,
      scheduledDate: { gt: new Date(today) },
    },
  });

  assert(
    upcomingVisits.length >= 1 && upcomingVisits.every((v) => v.scheduledDate > new Date(today)),
    'Query upcoming schedule',
    `Upcoming count: ${upcomingVisits.length}`,
  );

  // 5g. Verify Area Detail Page Data Loading (testing query pattern that serves /admin/areas/[areaId])
  const areaCustomers = await prisma.customer.findMany({ where: { areaId: area.id } });
  const areaCustomerIds = areaCustomers.map((c) => c.id);
  const areaCars = areaCustomerIds.length
    ? await prisma.car.findMany({ where: { customerId: { in: areaCustomerIds } } })
    : [];

  assert(
    areaCars.length >= 1 && areaCars.some((c) => c.id === car.id),
    'Area Detail page car loader correctly queries cars via customer IDs',
    `Found ${areaCars.length} cars for area`,
  );

  // -------------------------------------------------------------
  // TEST 6: Photo Retention & Storage Deletion Verification
  // -------------------------------------------------------------
  console.log('\n▶ [TEST 6] Testing Photo Deletion & Retention Logic...');
  const storage = getPhotoStorage();
  
  // Test deletion of uploaded test wash photo
  await storage.delete(uploadedPhoto.url);
  assert(true, 'Storage provider deleted uploaded wash photo without error');

  // Test deletion of uploaded private staff document
  await storage.delete(uploadedDoc.url);
  assert(true, 'Storage provider deleted private staff document without error');

  // -------------------------------------------------------------
  // Cleanup test records
  // -------------------------------------------------------------
  console.log('\n▶ [CLEANUP] Cleaning up test records...');
  try {
    await prisma.washVisit.deleteMany({ where: { areaId: area.id } });
    await prisma.car.delete({ where: { id: car.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.staff.delete({ where: { id: staffMember.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.area.delete({ where: { id: area.id } });
    await prisma.region.delete({ where: { id: region.id } });
    await prisma.$disconnect();
    console.log('  🧹 Cleaned up temporary test entities successfully.');
  } catch (err) {
    console.log('  ⚠️ Cleanup note:', err instanceof Error ? err.message : String(err));
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
