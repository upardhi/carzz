import { notFound } from 'next/navigation';
import { AreaDetailClient, type WashItemData } from '@/components/console/AreaDetailClient';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { todayISO } from '@/lib/util/format';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';

export const metadata = { title: 'Area Details' };

export default async function AreaManagerAreaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ areaId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requirePermission('report:area');
  const { areaId } = await params;
  const { tab } = await searchParams;

  // Enforce area scope if restricted
  if (session.scope.areaIds && !session.scope.areaIds.includes(areaId)) {
    notFound();
  }

  const today = todayISO();
  const store = await getStore();

  const area = await store.areas.get(areaId);
  if (!area) {
    notFound();
  }

  const [
    region,
    staffList,
    customers,
    todayVisits,
    totalWashesCount,
    allTimeMissedCount,
    upcomingWashesCount,
    ratedVisits,
    packages,
  ] = await Promise.all([
    area.regionId ? store.regions.get(area.regionId) : Promise.resolve(null),
    store.staff.find({ where: { areaId: area.id, active: true } as never }),
    store.customers.find({ where: { areaId: area.id } as never }),
    store.visits.find({
      where: { areaId: area.id, scheduledDate: today } as never,
      orderBy: [{ field: 'scheduledTime', dir: 'asc' }],
    }),
    store.visits.count({
      areaId: area.id,
      status: 'DONE',
    } as never),
    store.visits.count({
      areaId: area.id,
      status: 'MISSED',
    } as never),
    store.visits.count({
      areaId: area.id,
      scheduledDate: { gt: today },
    } as never),
    store.visits.find({
      where: { areaId: area.id, rating: { gt: 0 } } as never,
      limit: 100,
    }),
    store.packages.find(),
  ]);

  const customerIds = customers.map((c) => c.id);
  const cars = customerIds.length
    ? await store.cars.find({ where: { customerId: { in: customerIds } } as never })
    : [];

  const foundCarIds = new Set(cars.map((c) => c.id));
  const missingCarIds = [...new Set(todayVisits.map((v) => v.carId).filter((id) => !foundCarIds.has(id)))];
  if (missingCarIds.length > 0) {
    const extraCars = await store.cars.find({ where: { id: { in: missingCarIds } } as never });
    cars.push(...extraCars);
  }

  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const carMap = new Map(cars.map((c) => [c.id, c]));
  const staffMap = new Map(staffList.map((s) => [s.id, s]));
  const areaManagers = staffList.filter((s) => s.role === 'MANAGER');
  const packageMap = new Map(packages.map((p) => [p.id, p]));

  // Today's Financial & Operational Metrics
  let todayRevenue = 0;
  let todayTargetRevenue = 0;
  let todayCost = 0;
  let todayLoss = 0;

  for (const v of todayVisits) {
    const car = carMap.get(v.carId);
    const pkg = car ? packageMap.get(car.packageId) : null;
    const revPerWash = pkg ? Math.round(pkg.price / Math.max(1, pkg.washesPerMonth)) : 150;
    const costPerWash = pkg ? Math.round(pkg.costToDeliver / Math.max(1, pkg.washesPerMonth)) : 60;

    todayTargetRevenue += revPerWash;

    if (v.status === 'DONE') {
      todayRevenue += revPerWash;
      todayCost += costPerWash;
    } else if (v.status === 'MISSED') {
      todayLoss += revPerWash;
    }
  }

  const todayProfit = todayRevenue - todayCost;
  const todayMargin = todayRevenue > 0 ? todayProfit / todayRevenue : 0;

  const todayDone = todayVisits.filter((v) => v.status === 'DONE').length;
  const todayInProgress = todayVisits.filter((v) => v.status === 'IN_PROGRESS').length;
  const todayPending = todayVisits.filter((v) => v.status === 'PENDING').length;
  const todayMissed = todayVisits.filter((v) => v.status === 'MISSED').length;
  const todayRemaining = todayPending + todayInProgress;
  const todayAssigned = todayVisits.filter((v) => Boolean(v.staffId)).length;
  const todayUnassigned = todayVisits.filter((v) => !v.staffId).length;

  const carsAssigned = cars.filter((c) => Boolean(c.assignedStaffId)).length;
  const carsUnassigned = cars.filter((c) => !c.assignedStaffId).length;

  const enrichedTodayVisits: WashItemData[] = todayVisits.map((v) => {
    const customer = customerMap.get(v.customerId);
    const car = carMap.get(v.carId);
    const staff = v.staffId ? staffMap.get(v.staffId) : null;

    return {
      id: v.id,
      scheduledDate: v.scheduledDate,
      scheduledTime: v.scheduledTime,
      status: v.status as WashItemData['status'],
      completedAt: v.completedAt,
      startedAt: v.startedAt,
      onTime: v.onTime,
      rating: v.rating,
      ratingComment: v.ratingComment,
      managerRating: v.managerRating,
      managerRatingComment: v.managerRatingComment,
      missReason: v.missReason,
      missNote: v.missNote,
      beforePhotoUrl: resolvePublicPhotoUrl(v.beforePhotoUrl),
      afterPhotoUrl: resolvePublicPhotoUrl(v.afterPhotoUrl),
      beforePhotoBytes: v.beforePhotoBytes,
      afterPhotoBytes: v.afterPhotoBytes,
      servicesDone: v.servicesDone,
      customer: {
        id: v.customerId,
        name: customer?.name || 'Customer',
        phone: customer?.phone || '—',
        address: customer?.address || '',
      },
      car: {
        id: v.carId,
        plate: car?.plate || '—',
        model: car?.model || '—',
        color: car?.colour || '',
        parkingSpot: car?.specialInstructions || '',
      },
      staff: staff
        ? {
            id: staff.id,
            name: staff.name,
            phone: staff.phone,
          }
        : null,
    };
  });

  const avgRating =
    ratedVisits.length > 0
      ? ratedVisits.reduce((s, v) => s + (v.rating || 0), 0) / ratedVisits.length
      : 0;

  const stats = {
    totalCars: cars.length,
    carsAssigned,
    carsUnassigned,
    totalCustomers: customers.length,
    totalStaff: staffList.length,
    todayTotal: todayVisits.length,
    todayDone,
    todayInProgress,
    todayPending,
    todayRemaining,
    todayMissed,
    todayAssigned,
    todayUnassigned,
    todayRevenue,
    todayTargetRevenue,
    todayCost,
    todayProfit,
    todayLoss,
    todayMargin,
    totalWashes: totalWashesCount,
    allTimeMissed: allTimeMissedCount,
    upcomingTotal: upcomingWashesCount,
    averageRating: avgRating,
  };

  const carsByCustomer = new Map<string, typeof cars>();
  for (const car of cars) {
    const list = carsByCustomer.get(car.customerId) || [];
    list.push(car);
    carsByCustomer.set(car.customerId, list);
  }

  const enrichedCustomers = customers.map((c) => {
    const custCars = carsByCustomer.get(c.id) || [];
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      altPhone: c.altPhone,
      address: c.address,
      landmark: c.landmark,
      status: (c.status || 'ACTIVE') as 'ACTIVE' | 'HOLD' | 'INACTIVE',
      source: c.source || 'ONLINE',
      joinedOn: c.joinedOn || '',
      cars: custCars.map((car) => {
        const pkg = packageMap.get(car.packageId);
        const st = car.assignedStaffId ? staffMap.get(car.assignedStaffId) : null;
        return {
          id: car.id,
          make: car.make,
          model: car.model,
          plate: car.plate,
          packageName: pkg?.name || 'Standard Wash',
          staffName: st?.name || null,
        };
      }),
    };
  });

  const initialTab = tab === 'washes' || tab === 'upcoming' || tab === 'customers' ? tab : 'today';

  return (
    <AreaDetailClient
      area={area}
      region={region}
      managers={areaManagers}
      basePath="/area/areas"
      initialTab={initialTab}
      stats={stats}
      initialTodayVisits={enrichedTodayVisits}
      initialStaffList={staffList.map((s) => ({ id: s.id, name: s.name }))}
      initialCustomers={enrichedCustomers}
    />
  );
}
