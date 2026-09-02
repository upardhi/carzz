import Link from 'next/link';
import clsx from 'clsx';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { LEAD_SOURCES, type Car, type Customer, type CustomerStatus } from '@/lib/data/types';
import { currentCycle, formatTime, money } from '@/lib/util/format';
import { LEAD_SOURCE_LABEL, PATTERN_SHORT } from '@/lib/util/labels';
import {
  IconCalendar,
  IconEye,
  IconMapPin,
  IconPlus,
  IconRupee,
  IconSliders,
  IconTag,
  IconUser,
  IconUsers,
} from '@/components/shell/icons';
import { Filters, PageSizeSelect } from './Filters';
import { DataTable } from '@/components/ui/DataTable';
import { StatCard, StatGrid } from '@/components/ui/StatCard';

const AVATAR_PALETTES = [
  { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]' }, // soft blue
  { bg: 'bg-[#ECFDF5]', text: 'text-[#059669]' }, // soft emerald
  { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]' }, // soft amber
  { bg: 'bg-[#F5F3FF]', text: 'text-[#7C3AED]' }, // soft purple
  { bg: 'bg-[#F0FDF4]', text: 'text-[#16A34A]' }, // soft green
  { bg: 'bg-[#FFF1F2]', text: 'text-[#E11D48]' }, // soft rose
  { bg: 'bg-[#ECFEFF]', text: 'text-[#0891B2]' }, // soft cyan
  { bg: 'bg-[#EEF2FF]', text: 'text-[#4F46E5]' }, // soft indigo
];

function getAvatarPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export async function ConsoleCustomers({
  session,
  base,
  searchParams,
}: {
  session: Session;
  base: string;
  searchParams: Record<string, string | undefined>;
}) {
  const store = await getStore();
  const cycle = currentCycle();
  const areaFilter = scopeAreaFilter(session.scope);

  const [all, areas, staff, packages, invoices] = await Promise.all([
    store.customers.find({
      where: areaFilter as never,
      orderBy: [{ field: 'name' }],
    }),
    store.areas.find(),
    store.staff.find({ where: { role: 'EMPLOYEE', ...areaFilter } as never }),
    store.packages.find(),
    store.invoices.find({ where: { cycle, ...areaFilter } as never }),
  ]);

  const customerIds = all.map((c) => c.id);
  const scopedCars = customerIds.length
    ? await store.cars.find({ where: { customerId: { in: customerIds } } as never })
    : [];
  const scopedInvoices = invoices;

  const carsByCustomer = new Map<string, Car[]>();
  for (const car of scopedCars) {
    const list = carsByCustomer.get(car.customerId) ?? [];
    list.push(car);
    carsByCustomer.set(car.customerId, list);
  }

  const invoiceByCustomer = new Map(scopedInvoices.map((i) => [i.customerId, i]));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const packageById = new Map(packages.map((p) => [p.id, p]));

  // Dynamic KPI calculations - 100% dynamic from scoped data
  const totalCustomers = all.length;
  const activeCustomers = all.filter((c) => c.status === 'ACTIVE').length;
  const holdCustomers = all.filter((c) => c.status === 'HOLD').length;
  const inactiveCustomers = all.filter((c) => c.status === 'INACTIVE').length;

  const activePercent = totalCustomers > 0 ? ((activeCustomers / totalCustomers) * 100).toFixed(1) : '0.0';
  const holdPercent = totalCustomers > 0 ? ((holdCustomers / totalCustomers) * 100).toFixed(1) : '0.0';
  const inactivePercent = totalCustomers > 0 ? ((inactiveCustomers / totalCustomers) * 100).toFixed(1) : '0.0';

  const totalCarsCount = scopedCars.length;

  const unpaidInvoices = scopedInvoices.filter((i) => i.status !== 'PAID' && i.amount - i.paidAmount > 0);
  const unpaidCount = unpaidInvoices.length;
  const unpaidAmount = unpaidInvoices.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);

  // Dynamic Filter Options: "if there is not data then dont show that option"
  const statusesInUse = new Set(all.map((c) => c.status));
  const statusOptions = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'HOLD', label: 'On hold' },
    { value: 'INACTIVE', label: 'Inactive' },
  ].filter((o) => statusesInUse.has(o.value as CustomerStatus));

  const paymentsInUse = new Set<string>();
  for (const c of all) {
    const inv = invoiceByCustomer.get(c.id);
    if (!inv) paymentsInUse.add('NONE');
    else if (inv.status === 'PAID' || inv.amount <= inv.paidAmount) paymentsInUse.add('PAID');
    else if (inv.paidAmount > 0) paymentsInUse.add('PARTIAL');
    else paymentsInUse.add('PENDING');
  }
  const paymentOptions = [
    { value: 'PAID', label: 'Paid' },
    { value: 'PARTIAL', label: 'Partial' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'NONE', label: 'No bill' },
  ].filter((o) => paymentsInUse.has(o.value));

  const patternsInUse = new Set<string>();
  for (const car of scopedCars) {
    if (car.schedulePattern) patternsInUse.add(car.schedulePattern);
  }
  const patternOptions = Object.entries(PATTERN_SHORT)
    .filter(([val]) => patternsInUse.has(val))
    .map(([value, label]) => ({ value, label }));

  const assignedStaffIds = new Set<string>();
  for (const car of scopedCars) {
    if (car.assignedStaffId) assignedStaffIds.add(car.assignedStaffId);
  }
  const staffOptions = staff
    .filter((s) => assignedStaffIds.has(s.id))
    .map((s) => ({ value: s.id, label: s.name }));

  const sourcesInUse = new Set(all.map((c) => c.source).filter(Boolean));
  const sourceOptions = LEAD_SOURCES
    .filter((s) => sourcesInUse.has(s))
    .map((s) => ({ value: s, label: LEAD_SOURCE_LABEL[s] || s }));

  const areasInUse = new Set(all.map((c) => c.areaId).filter(Boolean));
  const areaOptions = areas
    .filter((a) => areasInUse.has(a.id))
    .map((a) => ({ value: a.id, label: a.name }));

  // Filtering
  const query = (searchParams.q ?? '').trim().toLowerCase();
  const filtered = all.filter((customer) => {
    if (searchParams.status && customer.status !== searchParams.status) return false;
    if (searchParams.source && customer.source !== searchParams.source) return false;
    if (searchParams.area && customer.areaId !== searchParams.area) return false;

    const own = carsByCustomer.get(customer.id) ?? [];
    if (searchParams.staff && !own.some((c) => c.assignedStaffId === searchParams.staff)) {
      return false;
    }
    if (searchParams.pattern && !own.some((c) => c.schedulePattern === searchParams.pattern)) {
      return false;
    }

    if (searchParams.payment) {
      const invoice = invoiceByCustomer.get(customer.id);
      const state = !invoice
        ? 'NONE'
        : invoice.status === 'PAID' || invoice.amount <= invoice.paidAmount
          ? 'PAID'
          : invoice.paidAmount > 0
            ? 'PARTIAL'
            : 'PENDING';
      if (state !== searchParams.payment) return false;
    }

    if (query) {
      const haystack = [
        customer.name,
        customer.phone,
        customer.address,
        ...own.map((c) => c.plate),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  const pageSize = Math.min(100, Math.max(5, Number(searchParams.limit ?? 20) || 20));
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const buildPageUrl = (targetPage: number) => {
    const params = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(searchParams).filter(([, v]) => v !== undefined && v !== ''),
      ),
      page: String(targetPage),
    } as Record<string, string>);
    return `?${params.toString()}`;
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <IconUsers width={22} height={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Customers</h1>
            <p className="text-xs text-slate-500 font-medium">
              {filtered.length} of {all.length} customers
            </p>
          </div>
        </div>

        <Link
          href={`${base}/customers/new`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F2347] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-[#163363] transition-colors"
        >
          <IconPlus width={15} height={15} />
          Add customer
        </Link>
      </div>

      {/* 6 Reusable KPI Stat Cards */}
      <div className="my-6">
        <StatGrid columns={6}>
          <StatCard
            label="TOTAL"
            value={totalCustomers}
            tone="purple"
            subtext="All customers"
          />
          <StatCard
            label="ACTIVE"
            value={activeCustomers}
            tone="emerald"
            subtext={`${activePercent}% of total`}
          />
          <StatCard
            label="ON HOLD"
            value={holdCustomers}
            tone="amber"
            subtext={`${holdPercent}% of total`}
          />
          <StatCard
            label="INACTIVE"
            value={inactiveCustomers}
            tone="slate"
            subtext={`${inactivePercent}% of total`}
          />
          <StatCard
            label="CARS"
            value={totalCarsCount}
            tone="blue"
            subtext="Total cars"
          />
          <StatCard
            label="UNPAID THIS MONTH"
            value={unpaidCount}
            tone="amber"
            subtext={money(unpaidAmount)}
          />
        </StatGrid>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-4">
        <Filters
          search={{ name: 'q', placeholder: 'Search by name, phone or car number...' }}
          filters={[
            {
              name: 'status',
              label: 'Status — all',
              icon: <IconSliders width={13} height={13} />,
              options: statusOptions,
            },
            {
              name: 'payment',
              label: 'Payment — all',
              icon: <IconRupee width={13} height={13} />,
              options: paymentOptions,
            },
            {
              name: 'pattern',
              label: 'Day — all',
              icon: <IconCalendar width={13} height={13} />,
              options: patternOptions,
            },
            {
              name: 'staff',
              label: 'Wash boy — all',
              icon: <IconUser width={13} height={13} />,
              options: staffOptions,
            },
            {
              name: 'source',
              label: 'Source — all',
              icon: <IconTag width={13} height={13} />,
              options: sourceOptions,
            },
            ...(areaOptions.length > 1
              ? [
                  {
                    name: 'area',
                    label: 'Area — all',
                    icon: <IconMapPin width={13} height={13} />,
                    options: areaOptions,
                  },
                ]
              : []),
          ]}
        />
      </div>

      {/* Modern Reusable Customers Table matching Image 2 */}
      <DataTable<Customer>
        data={pageRows}
        keyExtractor={(c) => c.id}
        itemLabel="customers"
        page={page}
        pageSize={pageSize}
        totalItems={filtered.length}
        buildPageUrl={buildPageUrl}
        pageSizeElement={<PageSizeSelect value={pageSize} />}
        emptyMessage="No customers match these filters."
        columns={[
          {
            id: 'customer',
            header: (
              <span className="inline-flex items-center gap-1">
                Customer
                <svg className="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 7l5-5 5 5H5zM5 13l5 5 5-5H5z" />
                </svg>
              </span>
            ),
            render: (customer) => {
              const palette = getAvatarPalette(customer.name);
              const initials = getInitials(customer.name);
              return (
                <div className="flex items-center gap-2.5">
                  <div
                    className={clsx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      palette.bg,
                      palette.text,
                    )}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`${base}/customers/${customer.id}`}
                      className="block font-semibold text-slate-900 text-xs sm:text-sm hover:text-blue-600 transition-colors"
                    >
                      {customer.name}
                    </Link>
                    <div className="text-[11px] font-medium text-slate-400">
                      {areaById.get(customer.areaId)?.name ?? '—'}
                    </div>
                  </div>
                </div>
              );
            },
          },
          {
            id: 'cars',
            header: 'Cars',
            render: (customer) => {
              const own = carsByCustomer.get(customer.id) ?? [];
              return (
                <span className="text-xs sm:text-sm font-medium text-slate-700">
                  {own.length}
                </span>
              );
            },
          },
          {
            id: 'schedule',
            header: (
              <span className="inline-flex items-center gap-1">
                Schedule
                <svg className="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </span>
            ),
            className: 'whitespace-nowrap',
            render: (customer) => {
              const own = carsByCustomer.get(customer.id) ?? [];
              const first = own[0];
              return first ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                  <IconCalendar width={13} height={13} className="text-slate-400 shrink-0" />
                  <span>
                    {PATTERN_SHORT[first.schedulePattern]} · {formatTime(first.scheduleTime)}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              );
            },
          },
          {
            id: 'washBoy',
            header: 'Wash boy',
            className: 'whitespace-nowrap',
            render: (customer) => {
              const own = carsByCustomer.get(customer.id) ?? [];
              const first = own[0];
              return first?.assignedStaffId ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EFF6FF] text-[#2563EB]">
                  <IconUser width={12} height={12} className="shrink-0 text-[#2563EB]" />
                  <span>{staffById.get(first.assignedStaffId)?.name ?? '—'}</span>
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF2F2] text-[#EF4444]">
                  Unassigned
                </span>
              );
            },
          },
          {
            id: 'monthly',
            header: 'Monthly',
            className: 'whitespace-nowrap',
            render: (customer) => {
              const own = carsByCustomer.get(customer.id) ?? [];
              const monthly = own.reduce(
                (sum, car) => sum + (packageById.get(car.packageId)?.price ?? 0),
                0,
              );
              return (
                <span className="text-xs sm:text-sm font-semibold text-slate-800">
                  {money(monthly)}
                </span>
              );
            },
          },
          {
            id: 'payment',
            header: 'Payment',
            className: 'whitespace-nowrap',
            render: (customer) => {
              const invoice = invoiceByCustomer.get(customer.id);
              const owed = invoice ? invoice.amount - invoice.paidAmount : 0;
              return !invoice ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  No bill
                </span>
              ) : owed <= 0 ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#ECFDF5] text-[#059669]">
                  Paid
                </span>
              ) : invoice.paidAmount > 0 ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFF7ED] text-[#D97706]">
                  Partial · {money(owed)}
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF2F2] text-[#DC2626]">
                  Due {money(owed)}
                </span>
              );
            },
          },
          {
            id: 'status',
            header: 'Status',
            className: 'whitespace-nowrap',
            render: (customer) => (
              <span
                className={clsx(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                  customer.status === 'ACTIVE'
                    ? 'bg-[#ECFDF5] text-[#059669]'
                    : customer.status === 'HOLD'
                      ? 'bg-[#FFF7ED] text-[#D97706]'
                      : 'bg-[#F1F5F9] text-[#475569]',
                )}
              >
                {customer.status === 'ACTIVE'
                  ? 'Active'
                  : customer.status === 'HOLD'
                    ? 'Hold'
                    : 'Inactive'}
              </span>
            ),
          },
          {
            id: 'source',
            header: 'Source',
            className: 'whitespace-nowrap',
            render: (customer) => (
              <span className="text-xs text-slate-500 font-medium">
                {LEAD_SOURCE_LABEL[customer.source as keyof typeof LEAD_SOURCE_LABEL] ?? customer.source}
              </span>
            ),
          },
          {
            id: 'actions',
            header: 'Actions',
            align: 'right',
            className: 'whitespace-nowrap',
            render: (customer) => (
              <Link
                href={`${base}/customers/${customer.id}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-colors shadow-2xs"
                title="View customer details"
              >
                <IconEye width={14} height={14} />
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}

