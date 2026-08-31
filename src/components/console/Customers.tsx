import Link from 'next/link';
import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  ButtonLink,
  Kpi,
  KpiGrid,
  Table,
  TableWrap,
  Tag,
  Td,
  Th,
} from '@/components/ui/primitives';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { LEAD_SOURCES } from '@/lib/data/types';
import { currentCycle, formatTime, money } from '@/lib/util/format';
import { LEAD_SOURCE_LABEL, PATTERN_SHORT } from '@/lib/util/labels';
import { Filters } from './Filters';

const PAGE_SIZE = 25;

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

  const [all, areas, staff, packages] = await Promise.all([
    store.customers.find({
      where: areaFilter as never,
      orderBy: [{ field: 'name' }],
    }),
    store.areas.find(),
    store.staff.find({ where: { role: 'EMPLOYEE', ...areaFilter } as never }),
    store.packages.find(),
  ]);

  const [cars, invoices] = await Promise.all([
    store.cars.find(),
    store.invoices.find({ where: { cycle, ...areaFilter } as never }),
  ]);

  const carsByCustomer = new Map<string, typeof cars>();
  for (const car of cars) {
    const list = carsByCustomer.get(car.customerId) ?? [];
    list.push(car);
    carsByCustomer.set(car.customerId, list);
  }
  const invoiceByCustomer = new Map(invoices.map((i) => [i.customerId, i]));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const packageById = new Map(packages.map((p) => [p.id, p]));

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
        : invoice.status === 'PAID'
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

  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${filtered.length} of ${all.length} customers`}
        actions={
          <ButtonLink href={`${base}/customers/new`} size="sm">
            + Add customer
          </ButtonLink>
        }
      />

      <KpiGrid>
        <Kpi label="Total" value={all.length} />
        <Kpi
          label="Active"
          value={all.filter((c) => c.status === 'ACTIVE').length}
          tone="success"
        />
        <Kpi
          label="On hold"
          value={all.filter((c) => c.status === 'HOLD').length}
          tone="gold"
        />
        <Kpi
          label="Inactive"
          value={all.filter((c) => c.status === 'INACTIVE').length}
        />
        <Kpi label="Cars" value={cars.filter((c) => c.active).length} />
        <Kpi
          label="Unpaid this month"
          value={invoices.filter((i) => i.status !== 'PAID').length}
          tone="gold"
        />
      </KpiGrid>

      <div className="mt-4">
        <Filters
          search={{ name: 'q', placeholder: 'Name, phone or car number' }}
          filters={[
            {
              name: 'status',
              label: 'Status — all',
              options: [
                { value: 'ACTIVE', label: 'Active' },
                { value: 'HOLD', label: 'On hold' },
                { value: 'INACTIVE', label: 'Inactive' },
              ],
            },
            {
              name: 'payment',
              label: 'Payment — all',
              options: [
                { value: 'PAID', label: 'Paid' },
                { value: 'PARTIAL', label: 'Partial' },
                { value: 'PENDING', label: 'Pending' },
              ],
            },
            {
              name: 'pattern',
              label: 'Day — all',
              options: Object.entries(PATTERN_SHORT).map(([value, label]) => ({
                value,
                label,
              })),
            },
            {
              name: 'staff',
              label: 'Wash boy — all',
              options: staff.map((s) => ({ value: s.id, label: s.name })),
            },
            {
              name: 'source',
              label: 'Source — all',
              options: LEAD_SOURCES.map((s) => ({
                value: s,
                label: LEAD_SOURCE_LABEL[s],
              })),
            },
            ...(session.scope.areaIds && session.scope.areaIds.length > 1
              ? [
                  {
                    name: 'area',
                    label: 'Area — all',
                    options: areas
                      .filter((a) => session.scope.areaIds!.includes(a.id))
                      .map((a) => ({ value: a.id, label: a.name })),
                  },
                ]
              : []),
          ]}
        />
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Cars</Th>
              <Th>Schedule</Th>
              <Th>Wash boy</Th>
              <Th>Monthly</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
              <Th>Source</Th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((customer) => {
              const own = carsByCustomer.get(customer.id) ?? [];
              const invoice = invoiceByCustomer.get(customer.id);
              const monthly = own.reduce(
                (sum, car) => sum + (packageById.get(car.packageId)?.price ?? 0),
                0,
              );
              const first = own[0];
              const owed = invoice ? invoice.amount - invoice.paidAmount : 0;

              return (
                <tr key={customer.id} className="cursor-pointer hover:bg-navy-50">
                  <Td>
                    <Link
                      href={`${base}/customers/${customer.id}`}
                      className="font-bold text-ink hover:text-navy-800"
                    >
                      {customer.name}
                    </Link>
                    <div className="text-[11px] text-ink-faint">
                      {areaById.get(customer.areaId)?.name}
                    </div>
                  </Td>
                  <Td>{own.length}</Td>
                  <Td className="whitespace-nowrap">
                    {first
                      ? `${PATTERN_SHORT[first.schedulePattern]} · ${formatTime(first.scheduleTime)}`
                      : '—'}
                  </Td>
                  <Td>
                    {first?.assignedStaffId
                      ? (staffById.get(first.assignedStaffId)?.name ?? '—')
                      : <span className="font-bold text-danger-500">Unassigned</span>}
                  </Td>
                  <Td>{money(monthly)}</Td>
                  <Td>
                    {!invoice ? (
                      <Tag tone="neutral">No bill</Tag>
                    ) : owed <= 0 ? (
                      <Tag tone="ok">Paid</Tag>
                    ) : invoice.paidAmount > 0 ? (
                      <Tag tone="warn">Partial · {money(owed)}</Tag>
                    ) : (
                      <Tag tone="bad">Due {money(owed)}</Tag>
                    )}
                  </Td>
                  <Td>
                    <Tag
                      tone={
                        customer.status === 'ACTIVE'
                          ? 'ok'
                          : customer.status === 'HOLD'
                            ? 'warn'
                            : 'neutral'
                      }
                    >
                      {customer.status === 'ACTIVE'
                        ? 'Active'
                        : customer.status === 'HOLD'
                          ? 'Hold'
                          : 'Inactive'}
                    </Tag>
                  </Td>
                  <Td className="text-[11.5px] text-ink-mute">
                    {LEAD_SOURCE_LABEL[customer.source]}
                  </Td>
                </tr>
              );
            })}
            {pageRows.length === 0 ? (
              <tr>
                <Td className="py-8 text-center text-ink-mute" colSpan={8}>
                  No customers match these filters.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </TableWrap>

      {totalPages > 1 ? (
        <nav className="mt-3 flex items-center gap-2" aria-label="Pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(
              (n) => n === 1 || n === totalPages || Math.abs(n - page) <= 2,
            )
            .map((n, index, list) => (
              <span key={n} className="flex items-center gap-2">
                {index > 0 && n - list[index - 1] > 1 ? (
                  <span className="text-ink-faint">…</span>
                ) : null}
                <Link
                  href={`?${new URLSearchParams({
                    ...Object.fromEntries(
                      Object.entries(searchParams).filter(([, v]) => v),
                    ),
                    page: String(n),
                  } as Record<string, string>)}`}
                  aria-current={n === page ? 'page' : undefined}
                  className={`rounded-md px-2.5 py-1 text-[13px] font-bold ${
                    n === page
                      ? 'bg-navy-800 text-white'
                      : 'border border-line-strong bg-white text-ink hover:bg-surface-muted'
                  }`}
                >
                  {n}
                </Link>
              </span>
            ))}
        </nav>
      ) : null}
    </>
  );
}
