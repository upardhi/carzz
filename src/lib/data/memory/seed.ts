import type {
  Area,
  Attendance,
  AppSettings,
  Car,
  Complaint,
  Customer,
  Expense,
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
  WeekdayPattern,
} from '../types';

export interface Db {
  users: User[];
  credentials: UserCredential[];
  regions: Region[];
  areas: Area[];
  staff: Staff[];
  attendance: Attendance[];
  pocketRequests: PocketMoneyRequest[];
  customers: Customer[];
  cars: Car[];
  packages: ServicePackage[];
  visits: WashVisit[];
  payments: Payment[];
  invoices: Invoice[];
  expenses: Expense[];
  payouts: StaffPayout[];
  complaints: Complaint[];
  inventoryItems: InventoryItem[];
  stockLevels: StockLevel[];
  purchaseRequests: PurchaseRequest[];
  stockIssues: StockIssue[];
  notifications: Notification[];
  appSettings: AppSettings;
  payoutSettings: PayoutSettings;
}

/** Deterministic PRNG so the demo dataset is identical on every boot. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const iso = (d: Date) => d.toISOString();
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const cycleOf = (d: Date) => d.toISOString().slice(0, 7);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

const PATTERN_DAYS: Record<WeekdayPattern, number[]> = {
  MON_THU: [1, 4],
  TUE_FRI: [2, 5],
  WED_SAT: [3, 6],
  THU_SUN: [4, 0],
};

const FIRST_NAMES = [
  'Shyam', 'Kavita', 'Imran', 'Deepak', 'Anjali', 'Nitin', 'Sana', 'Vijay',
  'Ramesh', 'Meena', 'Farhan', 'Asha', 'Rohit', 'Priya', 'Sagar', 'Neha',
  'Amit', 'Pooja', 'Kiran', 'Sunita', 'Manoj', 'Rekha', 'Vinod', 'Snehal',
  'Arun', 'Divya', 'Mahesh', 'Swati', 'Ganesh', 'Trupti',
];
const LAST_NAMES = [
  'Patil', 'Deshmukh', 'Shaikh', 'Rao', 'Kulkarni', 'Bhosale', 'Qureshi',
  'More', 'Tiwari', 'Sharma', 'Ali', 'Joshi', 'Kamble', 'Wankhede', 'Gaikwad',
  'Meshram', 'Dhote', 'Rathod', 'Pawar', 'Chavan',
];
const CAR_MODELS: [string, string][] = [
  ['Swift', 'Maruti'], ['WagonR', 'Maruti'], ['Baleno', 'Maruti'],
  ['i20', 'Hyundai'], ['Creta', 'Hyundai'], ['Venue', 'Hyundai'],
  ['Nexon', 'Tata'], ['Altroz', 'Tata'], ['City', 'Honda'],
  ['Seltos', 'Kia'], ['XUV700', 'Mahindra'], ['Ertiga', 'Maruti'],
];
const COLOURS = ['White', 'Silver', 'Grey', 'Red', 'Blue', 'Black', 'Brown'];
const SOCIETIES = [
  'Sai Residency', 'Green Park', 'Laxmi Nagar', 'Shivaji Chowk',
  'Trimurti Nagar', 'Ashirwad Heights', 'Gokul Enclave', 'Sunrise Towers',
];

/**
 * Builds the full demo dataset.
 *
 * `today` is injected so the generated schedule always straddles the current
 * date — the app then has real past visits to report on and real upcoming
 * visits to work through, whenever it is run.
 */
export function buildSeed(today = new Date()): Db {
  const rand = rng(20260826);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

  const now = iso(today);
  const cycle = cycleOf(today);
  const prevCycle = cycleOf(new Date(today.getFullYear(), today.getMonth() - 1, 15));

  const users: User[] = [];
  const credentials: UserCredential[] = [];
  const addUser = (u: Omit<User, 'createdAt'>, password: string): User => {
    const full: User = { ...u, createdAt: now };
    users.push(full);
    // Seeded logins use a marker the auth layer recognises and upgrades to a
    // real hash on first successful sign-in.
    credentials.push({ userId: u.id, passwordHash: `seed:${password}` });
    return full;
  };

  /* ---- packages ---- */
  const packages: ServicePackage[] = [
    {
      id: 'pkg_bucket', name: 'Bucket Wash', washesPerMonth: 8, price: 1600,
      costToDeliver: 536, services: ['Exterior wash', 'Interior vacuum'], active: true,
    },
    {
      id: 'pkg_pressure', name: 'Pressure Wash', washesPerMonth: 8, price: 2000,
      costToDeliver: 712, services: ['Pressure wash', 'Interior vacuum', 'Tyre dressing'], active: true,
    },
    {
      id: 'pkg_detailing', name: 'Detailing', washesPerMonth: 4, price: 3200,
      costToDeliver: 1640, services: ['Pressure wash', 'Interior vacuum', 'Polish / wax', 'Tyre dressing'], active: true,
    },
  ];

  /* ---- org ---- */
  const regions: Region[] = [
    { id: 'rg_nagpur', name: 'Nagpur', areaAdminId: 'usr_areaadmin', createdAt: now },
  ];

  const areaSpec = [
    { id: 'ar_wadi', name: 'Wadi', managerName: 'Sunita Kale', employees: 4 },
    { id: 'ar_bajaj', name: 'Bajaj Nagar', managerName: 'Manoj Pawar', employees: 5 },
    { id: 'ar_civil', name: 'Civil Lines', managerName: 'Rekha Joshi', employees: 5 },
  ];

  const areas: Area[] = [];
  const staff: Staff[] = [];

  addUser({
    id: 'usr_super', name: 'Owner', email: 'owner@carzz.app', phone: '9800000001',
    role: 'SUPER_ADMIN', regionId: null, areaId: null, customerId: null,
    staffId: null, language: 'en', active: true,
  }, 'owner123');

  addUser({
    id: 'usr_areaadmin', name: 'Vikram Nair', email: 'areaadmin@carzz.app', phone: '9800000002',
    role: 'AREA_ADMIN', regionId: 'rg_nagpur', areaId: null, customerId: null,
    staffId: null, language: 'en', active: true,
  }, 'area123');

  const EMPLOYEE_NAMES = [
    'Rahul Wankhede', 'Sunil Gaikwad', 'Ajay Meshram', 'Prakash Dhote',
    'Ganesh Rathod', 'Vinod Kamble', 'Sagar Chavan', 'Arun More',
    'Mahesh Tiwari', 'Kiran Bhosale', 'Amit Rao', 'Rohit Sharma',
    'Farhan Ali', 'Nitin Joshi',
  ];
  let employeeCursor = 0;

  areaSpec.forEach((spec, ai) => {
    const managerStaffId = `stf_mgr_${spec.id}`;
    const managerUserId = `usr_mgr_${spec.id}`;

    areas.push({
      id: spec.id, regionId: 'rg_nagpur', name: spec.name, city: 'Nagpur',
      managerId: managerStaffId, createdAt: now,
    });

    addUser({
      id: managerUserId, name: spec.managerName,
      email: `manager.${spec.name.toLowerCase().replace(/\s+/g, '')}@carzz.app`,
      phone: `98111000${ai + 1}`, role: 'MANAGER', regionId: 'rg_nagpur',
      areaId: spec.id, customerId: null, staffId: managerStaffId,
      language: 'en', active: true,
    }, 'manager123');

    staff.push({
      id: managerStaffId, userId: managerUserId, name: spec.managerName,
      phone: `98111000${ai + 1}`, areaId: spec.id, role: 'MANAGER',
      joinedOn: dateOnly(addDays(today, -420)), referredByStaffId: null, active: true,
    });

    for (let e = 0; e < spec.employees; e += 1) {
      const name = EMPLOYEE_NAMES[employeeCursor % EMPLOYEE_NAMES.length];
      employeeCursor += 1;
      const staffId = `stf_${spec.id}_${e}`;
      const userId = `usr_${staffId}`;
      const phone = `9822${String(100000 + employeeCursor).slice(-6)}`;

      addUser({
        id: userId, name, email: `${name.split(' ')[0].toLowerCase()}${employeeCursor}@carzz.app`,
        phone, role: 'EMPLOYEE', regionId: 'rg_nagpur', areaId: spec.id,
        customerId: null, staffId, language: e % 3 === 0 ? 'mr' : e % 3 === 1 ? 'hi' : 'en',
        active: true,
      }, 'staff123');

      staff.push({
        id: staffId, userId, name, phone, areaId: spec.id, role: 'EMPLOYEE',
        joinedOn: dateOnly(addDays(today, -int(60, 500))),
        referredByStaffId: e > 1 ? `stf_${spec.id}_0` : null,
        active: true,
      });
    }
  });

  const employeesByArea = (areaId: string) =>
    staff.filter((s) => s.areaId === areaId && s.role === 'EMPLOYEE');

  /* ---- customers & cars ---- */
  const customers: Customer[] = [];
  const cars: Car[] = [];
  const sources = ['GUARD_REF', 'CUSTOMER_REF', 'STAFF_REF', 'DETAILING_CENTRE', 'ONLINE_ADS', 'PAMPHLET'] as const;
  const sourceWeights = [30, 18, 22, 5, 15, 10];
  const weightedSource = () => {
    const total = sourceWeights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    for (let i = 0; i < sources.length; i += 1) {
      r -= sourceWeights[i];
      if (r <= 0) return sources[i];
    }
    return 'OTHER' as const;
  };

  const patterns: WeekdayPattern[] = ['MON_THU', 'TUE_FRI', 'WED_SAT', 'THU_SUN'];
  const slotTimes = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00'];

  const perArea = [62, 58, 54];
  areaSpec.forEach((spec, ai) => {
    const emps = employeesByArea(spec.id);
    for (let c = 0; c < perArea[ai]; c += 1) {
      const customerId = `cus_${spec.id}_${c}`;
      const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      const status = c % 17 === 0 ? 'HOLD' : c % 29 === 0 ? 'INACTIVE' : 'ACTIVE';

      customers.push({
        id: customerId, userId: null, areaId: spec.id, name,
        phone: `98${String(30000000 + ai * 100000 + c * 137).slice(-8)}`,
        altPhone: rand() > 0.6 ? `97${String(30000000 + c * 211).slice(-8)}` : null,
        address: `${pick(SOCIETIES)}, Flat ${int(101, 604)}`,
        landmark: rand() > 0.5 ? `Near ${pick(['Ram Mandir', 'DMart', 'Bus stop', 'Petrol pump', 'City Hospital'])}` : null,
        lat: 21.14 + rand() * 0.06, lng: 79.06 + rand() * 0.08,
        source: weightedSource(),
        referredById: null,
        status, holdUntil: status === 'HOLD' ? dateOnly(addDays(today, 14)) : null,
        note: rand() > 0.75 ? pick(['Ring the bell', 'Dog in compound', 'Park at gate side', 'Call before arriving']) : null,
        joinedOn: dateOnly(addDays(today, -int(20, 400))),
      });

      // Roughly a fifth of accounts carry a second car — the multi-car case the
      // client specifically wanted to see working.
      const carCount = rand() > 0.8 ? 2 : 1;
      const pattern = pick(patterns);
      const baseSlot = int(0, slotTimes.length - 2);
      const emp = emps[c % emps.length];

      for (let k = 0; k < carCount; k += 1) {
        const [model, make] = pick(CAR_MODELS);
        cars.push({
          id: `car_${customerId}_${k}`, customerId, model, make,
          colour: pick(COLOURS),
          plate: `MH31 ${String.fromCharCode(65 + int(0, 25))}${String.fromCharCode(65 + int(0, 25))} ${String(int(1000, 9999))}`,
          packageId: rand() > 0.82 ? 'pkg_detailing' : rand() > 0.45 ? 'pkg_pressure' : 'pkg_bucket',
          assignedStaffId: status === 'INACTIVE' ? null : emp.id,
          schedulePattern: pattern,
          scheduleTime: slotTimes[Math.min(baseSlot + k, slotTimes.length - 1)],
          specialInstructions: k === 0 ? null : 'Second car — same building',
          active: status !== 'INACTIVE',
        });
      }
    }
  });

  // A handful of customers get an app login so the customer role is testable.
  const demoCustomer = customers.find((c) => c.areaId === 'ar_wadi' && c.status === 'ACTIVE')!;
  const demoTwoCarCustomer =
    customers.find((c) => cars.filter((x) => x.customerId === c.id).length === 2) ?? demoCustomer;
  demoTwoCarCustomer.name = 'Shyam Patil';
  demoTwoCarCustomer.userId = 'usr_customer';
  addUser({
    id: 'usr_customer', name: demoTwoCarCustomer.name, email: 'customer@carzz.app',
    phone: demoTwoCarCustomer.phone, role: 'CUSTOMER', regionId: null,
    areaId: demoTwoCarCustomer.areaId, customerId: demoTwoCarCustomer.id,
    staffId: null, language: 'en', active: true,
  }, 'customer123');

  /* ---- visits: two months back, one month forward ---- */
  const visits: WashVisit[] = [];
  const missReasons = ['CAR_NOT_AVAILABLE', 'CUSTOMER_SKIPPED', 'WEATHER', 'NO_WATER_OR_ACCESS', 'STAFF_ABSENT'] as const;
  const start = addDays(today, -60);

  for (const car of cars) {
    if (!car.active) continue;
    const customer = customers.find((c) => c.id === car.customerId)!;
    const pkg = packages.find((p) => p.id === car.packageId)!;
    const days = PATTERN_DAYS[car.schedulePattern];
    // A detailing package visits weekly rather than twice a week.
    const activeDays = pkg.washesPerMonth <= 4 ? [days[0]] : days;

    for (let d = 0; d <= 90; d += 1) {
      const day = addDays(start, d);
      if (!activeDays.includes(day.getDay())) continue;

      const isPast = day < today && dateOnly(day) !== dateOnly(today);
      const roll = rand();
      let status: WashVisit['status'] = 'PENDING';
      let missReason: WashVisit['missReason'] = null;

      if (isPast) {
        // Civil Lines misses noticeably more washes — that gap is the story the
        // Super Admin's area comparison is meant to surface.
        const missRate = car.assignedStaffId?.startsWith('stf_ar_civil') ? 0.11 : 0.045;
        status = roll < missRate ? 'MISSED' : 'DONE';
        if (status === 'MISSED') missReason = pick(missReasons);
      }

      const slotAt = new Date(`${dateOnly(day)}T${car.scheduleTime}:00.000Z`);
      const completedAt =
        status === 'DONE'
          ? iso(new Date(slotAt.getTime() + int(1, 26) * 60000))
          : null;

      visits.push({
        id: `vst_${car.id}_${d}`,
        carId: car.id, customerId: customer.id, areaId: customer.areaId,
        staffId: car.assignedStaffId, cycle: cycleOf(day),
        scheduledDate: dateOnly(day), scheduledTime: car.scheduleTime,
        status,
        startedAt: status === 'DONE' ? completedAt : null,
        completedAt,
        servicesDone: status === 'DONE' ? pkg.services.slice(0, int(1, pkg.services.length)) : [],
        beforePhotoUrl: status === 'DONE' ? `/api/photos/${car.id}-${d}-before` : null,
        afterPhotoUrl: status === 'DONE' ? `/api/photos/${car.id}-${d}-after` : null,
        missReason, missNote: null, rescheduledToVisitId: null,
        rating: status === 'DONE' && rand() > 0.35 ? int(3, 5) : null,
        ratingComment: null,
        onTime: status === 'DONE' ? rand() > 0.16 : false,
      });
    }
  }

  /* ---- invoices & payments ---- */
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  const modes = ['CASH', 'MANUAL_UPI', 'GATEWAY'] as const;

  for (const customer of customers) {
    const own = cars.filter((c) => c.customerId === customer.id);
    const monthly = own.reduce(
      (sum, car) => sum + (packages.find((p) => p.id === car.packageId)?.price ?? 0),
      0,
    );
    if (monthly === 0) continue;

    for (const cyc of [prevCycle, cycle]) {
      const isCurrent = cyc === cycle;
      const roll = rand();
      const paidAmount = roll < 0.62 ? monthly : roll < 0.78 ? Math.round(monthly / 2) : 0;
      const dueOn = `${cyc}-05`;
      const status: Invoice['status'] =
        paidAmount >= monthly ? 'PAID'
          : paidAmount > 0 ? 'PARTIAL'
          : isCurrent ? 'OPEN' : 'OVERDUE';

      invoices.push({
        id: `inv_${customer.id}_${cyc}`, customerId: customer.id,
        areaId: customer.areaId, cycle: cyc, amount: monthly, dueOn,
        paidAmount, status, createdAt: iso(new Date(`${cyc}-01T00:00:00.000Z`)),
      });

      if (paidAmount > 0) {
        payments.push({
          id: `pay_${customer.id}_${cyc}`, customerId: customer.id,
          areaId: customer.areaId, amount: paidAmount, kind: 'PACKAGE',
          mode: pick(modes), status: 'CONFIRMED', cycle: cyc,
          recordedByUserId: null, reference: null, note: null,
          createdAt: iso(new Date(`${cyc}-0${int(2, 8)}T09:00:00.000Z`)),
        });
      }
    }

    if (rand() > 0.7) {
      payments.push({
        id: `pay_adv_${customer.id}`, customerId: customer.id,
        areaId: customer.areaId, amount: monthly * 2, kind: 'ADVANCE',
        mode: 'GATEWAY', status: 'CONFIRMED', cycle: prevCycle,
        recordedByUserId: null, reference: null, note: 'Opening advance',
        createdAt: iso(addDays(today, -int(40, 90))),
      });
    }
  }

  /* ---- attendance & pocket money ---- */
  const attendance: Attendance[] = [];
  const pocketRequests: PocketMoneyRequest[] = [];

  for (const s of staff) {
    if (s.role !== 'EMPLOYEE') continue;
    for (let d = 30; d >= 0; d -= 1) {
      const day = addDays(today, -d);
      if (day.getDay() === 0) continue;
      const roll = rand();
      const status: Attendance['status'] =
        roll < 0.05 ? 'OFF' : roll < 0.07 ? 'OFF_UNINFORMED' : 'PRESENT';
      attendance.push({
        id: `att_${s.id}_${d}`, staffId: s.id, date: dateOnly(day),
        loginAt: status === 'PRESENT'
          ? iso(new Date(`${dateOnly(day)}T0${int(6, 8)}:${String(int(10, 59))}:00.000Z`))
          : null,
        status, note: null,
      });
    }

    for (let w = 0; w < 3; w += 1) {
      if (rand() > 0.55) continue;
      pocketRequests.push({
        id: `pkt_${s.id}_${w}`, staffId: s.id, amount: int(3, 12) * 100,
        status: w === 0 ? 'PENDING' : 'PAID',
        requestedAt: iso(addDays(today, -(w * 7 + int(0, 3)))),
        decidedAt: w === 0 ? null : iso(addDays(today, -(w * 7))),
        decidedByUserId: w === 0 ? null : `usr_mgr_${s.areaId}`,
        overrodeCap: false, note: null,
      });
    }
  }

  /* ---- complaints ---- */
  const complaints: Complaint[] = [];
  const complaintTypes = ['WASH_QUALITY', 'STAFF_LATE', 'WASH_NOT_DONE', 'PAYMENT_ISSUE', 'STAFF_BEHAVIOUR'] as const;
  const complaintBodies: Record<string, string[]> = {
    WASH_QUALITY: ['Inside not vacuumed properly. Dashboard was dusty.', 'Water marks left all over the bonnet.'],
    STAFF_LATE: ['Boy came at 10 instead of 9. Third time this month.', 'Nobody turned up until 11 AM.'],
    WASH_NOT_DONE: ['Wash was skipped without telling me.', 'No one came, no message either.'],
    PAYMENT_ISSUE: ['I paid by UPI but the app still shows pending.', 'Receipt never arrived.'],
    STAFF_BEHAVIOUR: ['Boy argued with the watchman and used bad language.', 'Very rude when I asked him to redo the tyres.'],
  };

  for (let i = 0; i < 42; i += 1) {
    const customer = pick(customers);
    const car = cars.find((c) => c.customerId === customer.id);
    const type = pick(complaintTypes);
    const age = int(0, 28);
    const resolved = age > 4 && rand() > 0.3;
    const escalated = !resolved && rand() > 0.75;

    complaints.push({
      id: `cmp_${i}`, customerId: customer.id, areaId: customer.areaId,
      staffId: car?.assignedStaffId ?? null, visitId: null, type,
      body: pick(complaintBodies[type]),
      status: resolved ? 'RESOLVED' : escalated ? 'ESCALATED' : 'OPEN',
      resolution: resolved ? pick(['Free re-wash given', 'Rescheduled, wash returned to count', 'Receipt re-sent', 'Slot changed']) : null,
      createdAt: iso(addDays(today, -age)),
      resolvedAt: resolved ? iso(addDays(today, -age + int(1, 3))) : null,
      handledByUserId: resolved ? `usr_mgr_${customer.areaId}` : null,
    });
  }

  /* ---- inventory ---- */
  const inventoryItems: InventoryItem[] = [
    { id: 'itm_shampoo', name: 'Car shampoo', unit: 'L', usagePerWash: 0.039, reorderLevel: 15, unitCost: 120, active: true },
    { id: 'itm_cloth', name: 'Microfibre cloth', unit: 'pcs', usagePerWash: 0.04, reorderLevel: 40, unitCost: 35, active: true },
    { id: 'itm_tyre', name: 'Tyre polish', unit: 'L', usagePerWash: 0.008, reorderLevel: 5, unitCost: 275, active: true },
    { id: 'itm_dash', name: 'Dashboard polish', unit: 'L', usagePerWash: 0.007, reorderLevel: 3, unitCost: 240, active: true },
    { id: 'itm_glass', name: 'Glass cleaner', unit: 'L', usagePerWash: 0.01, reorderLevel: 4, unitCost: 120, active: true },
    { id: 'itm_bucket', name: 'Bucket (20 L)', unit: 'pcs', usagePerWash: 0, reorderLevel: 4, unitCost: 210, active: true },
    { id: 'itm_uniform', name: 'Uniform t-shirt', unit: 'pcs', usagePerWash: 0, reorderLevel: 5, unitCost: 240, active: true },
    { id: 'itm_pump', name: 'Pressure pump spare kit', unit: 'sets', usagePerWash: 0, reorderLevel: 1, unitCost: 1800, active: true },
  ];

  const stockLevels: StockLevel[] = [];
  const stockSeed: Record<string, number[]> = {
    itm_shampoo: [4, 22, 14], itm_cloth: [0, 60, 12], itm_tyre: [2, 3, 7],
    itm_dash: [6, 8, 5], itm_glass: [9, 11, 8], itm_bucket: [11, 13, 12],
    itm_uniform: [7, 14, 11], itm_pump: [2, 3, 2],
  };
  areaSpec.forEach((spec, ai) => {
    for (const item of inventoryItems) {
      stockLevels.push({
        id: `stk_${spec.id}_${item.id}`, areaId: spec.id, itemId: item.id,
        quantity: stockSeed[item.id][ai], updatedAt: now,
      });
    }
  });

  const purchaseRequests: PurchaseRequest[] = [
    {
      id: 'pr_1042', code: 'PR-1042', areaId: 'ar_wadi', itemId: 'itm_shampoo',
      quantity: 40, estimatedCost: 4800, neededBy: dateOnly(addDays(today, 2)),
      reason: 'Stock will finish in 1.4 days at current usage.', status: 'PENDING',
      raisedByUserId: 'usr_mgr_ar_wadi', decidedByUserId: null,
      createdAt: iso(addDays(today, -1)), decidedAt: null,
    },
    {
      id: 'pr_1044', code: 'PR-1044', areaId: 'ar_civil', itemId: 'itm_cloth',
      quantity: 150, estimatedCost: 5250, neededBy: dateOnly(addDays(today, 3)),
      reason: 'Two areas below reorder level.', status: 'PENDING',
      raisedByUserId: 'usr_mgr_ar_civil', decidedByUserId: null,
      createdAt: iso(addDays(today, -1)), decidedAt: null,
    },
    {
      id: 'pr_1045', code: 'PR-1045', areaId: 'ar_bajaj', itemId: 'itm_tyre',
      quantity: 10, estimatedCost: 2750, neededBy: dateOnly(addDays(today, 7)),
      reason: 'Routine top-up.', status: 'PENDING',
      raisedByUserId: 'usr_mgr_ar_bajaj', decidedByUserId: null,
      createdAt: iso(addDays(today, -2)), decidedAt: null,
    },
    {
      id: 'pr_1039', code: 'PR-1039', areaId: 'ar_wadi', itemId: 'itm_cloth',
      quantity: 100, estimatedCost: 3500, neededBy: dateOnly(addDays(today, 1)),
      reason: null, status: 'APPROVED', raisedByUserId: 'usr_mgr_ar_wadi',
      decidedByUserId: 'usr_super', createdAt: iso(addDays(today, -3)),
      decidedAt: iso(addDays(today, -2)),
    },
  ];

  const stockIssues: StockIssue[] = staff
    .filter((s) => s.role === 'EMPLOYEE')
    .slice(0, 9)
    .map((s, i) => ({
      id: `isu_${i}`, areaId: s.areaId, itemId: i % 2 ? 'itm_cloth' : 'itm_shampoo',
      staffId: s.id, quantity: i % 2 ? 2 : 1, issuedByUserId: `usr_mgr_${s.areaId}`,
      createdAt: now,
    }));

  /* ---- expenses ---- */
  const expenses: Expense[] = [];
  const expenseSpec: [Expense['head'], number][] = [
    ['GOODS', 38200], ['MARKETING', 12000], ['STATIONERY', 2400],
    ['RND', 8000], ['OTHER', 5000],
  ];
  for (const cyc of [prevCycle, cycle]) {
    for (const [head, amount] of expenseSpec) {
      expenses.push({
        id: `exp_${cyc}_${head}`, areaId: null, head,
        amount: Math.round(amount * (cyc === cycle ? 1 : 0.93)), cycle,
        note: null, recordedByUserId: 'usr_super',
        createdAt: iso(new Date(`${cyc}-28T00:00:00.000Z`)),
      });
    }
  }

  /* ---- settings ---- */
  const payoutSettings: PayoutSettings = {
    id: 'default',
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

  const appSettings: AppSettings = {
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

  return {
    users, credentials, regions, areas, staff, attendance, pocketRequests,
    customers, cars, packages, visits, payments, invoices, expenses,
    payouts: [] as StaffPayout[], complaints, inventoryItems, stockLevels,
    purchaseRequests, stockIssues, notifications: [] as Notification[],
    appSettings, payoutSettings,
  };
}
