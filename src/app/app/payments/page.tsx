import { notFound } from 'next/navigation';
import { Row } from '@/components/ui/primitives';
import {
  IconBox,
  IconCalendar,
  IconCreditCard,
  IconRupee,
  IconWallet,
} from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadCustomerAccount } from '@/lib/services/accounts';
import {
  currentCycle,
  formatDateFull,
  money,
} from '@/lib/util/format';
import { PAYMENT_MODE_LABEL } from '@/lib/util/labels';
import { PayActions } from './PayActions';

export const metadata = { title: 'Payments & Packages' };

function parseDateBadge(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString('en-IN', { month: 'short' });
    return { day, month };
  } catch {
    return { day: '—', month: '—' };
  }
}

export default async function CustomerPayments() {
  const session = await requirePermission('self:payments');
  const store = await getStore();
  const firstName = session.user.name.split(' ')[0] || 'Customer';

  const [account, settings, packages] = await Promise.all([
    loadCustomerAccount(store, session.user.customerId!, currentCycle()),
    store.getAppSettings(),
    store.packages.find({ where: { active: true } }),
  ]);
  if (!account) notFound();

  return (
    <div className="space-y-5">
      {/* 1. Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#071329] via-[#0d2247] to-[#123164] p-6 text-white shadow-md border border-navy-800/60">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl text-white flex items-center gap-2">
              Hello, {firstName}! <span className="animate-wiggle">👋</span>
            </h2>
            <p className="mt-1 text-xs md:text-sm text-slate-300 font-medium max-w-xl">
              Manage your subscription payments, invoices, online UPI transfers and available tiers.
            </p>
          </div>

          <div className="hidden md:flex flex-col items-end justify-center text-right shrink-0">
            <p className="font-serif italic text-xs md:text-sm text-slate-300 tracking-wide">
              &ldquo;A cleaner car for a brighter you.&rdquo;
            </p>
            <div className="mt-1.5 h-1 w-12 rounded-full bg-blue-500 shadow-sm" />
          </div>
        </div>

        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />
      </div>

      {/* 2. Top Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Outstanding / Due */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                account.outstanding > 0
                  ? 'border-amber-100/80 bg-amber-50 text-amber-600'
                  : 'border-emerald-100/80 bg-emerald-50 text-emerald-600'
              }`}
            >
              <IconCreditCard width={24} height={24} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                AMOUNT DUE
              </div>
              <div
                className={`mt-0.5 text-2xl font-black tracking-tight ${
                  account.outstanding > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {money(account.outstanding)}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                {account.outstanding > 0 && account.nextDue
                  ? `Due ${formatDateFull(account.nextDue.dueOn)}`
                  : 'Fully paid up'}
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Package */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-100/80 bg-blue-50 text-blue-600">
              <IconBox width={24} height={24} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                MONTHLY PACKAGE
              </div>
              <div className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">
                {money(account.monthly)}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                For {account.cars.length} registered {account.cars.length === 1 ? 'car' : 'cars'}
              </div>
            </div>
          </div>
        </div>

        {/* Balance Advance */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:col-span-1">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-purple-100/80 bg-purple-50 text-purple-600">
              <IconWallet width={24} height={24} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                ACCOUNT BALANCE
              </div>
              <div className="mt-0.5 text-2xl font-black tracking-tight text-purple-700">
                {money(Math.max(0, account.balance))}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                Advance credit in account
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Pay Online Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
            <IconRupee width={20} height={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Pay Subscription Online</h3>
            <p className="text-xs text-slate-500">Pay via Instant UPI QR, Net Banking, or record manual transfer</p>
          </div>
        </div>

        <div className="mt-5">
          <PayActions
            amount={account.outstanding}
            modes={settings.paymentModesEnabled}
          />
        </div>
      </div>

      {/* 4. Account Summary Ledger */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
            <IconWallet width={20} height={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Billing & Account Ledger</h3>
            <p className="text-xs text-slate-500">Statement of monthly charges, advances, and lifetime payments</p>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <Row label="Monthly Package Total" value={money(account.monthly)} />
          <Row label="Advance Deposited" value={money(account.advanceDeposited)} />
          <Row label="Total Amount Paid" value={money(account.totalPaid)} tone="success" />
          <Row label="Total Amount Billed" value={money(account.totalBilled)} />
          <Row
            label="Current Ledger Balance"
            value={money(Math.max(0, account.balance))}
            tone={account.balance >= 0 ? 'success' : undefined}
          />
          <Row
            label="Outstanding To Pay"
            value={money(account.outstanding)}
            tone={account.outstanding > 0 ? 'danger' : undefined}
          />
        </div>
      </div>

      {/* 5. Available Service Packages */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
              <IconBox width={20} height={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Available Packages</h3>
              <p className="text-xs text-slate-500 mt-0.5">Standard and premium car wash tiers available in your area</p>
            </div>
          </div>

          <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200/60">
            {packages.length} plans
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 transition-all hover:border-blue-400 hover:bg-white hover:shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-slate-900">{pkg.name}</h4>
                  <div className="text-base font-black text-blue-700">
                    {money(pkg.price)}
                    <span className="text-xs text-slate-400 font-normal"> /mo</span>
                  </div>
                </div>

                <p className="mt-1 text-xs text-slate-500 font-medium">
                  {pkg.washesPerMonth} washes per month · {money(Math.round(pkg.price / Math.max(1, pkg.washesPerMonth)))} per wash
                </p>

                {pkg.services && pkg.services.length > 0 && (
                  <ul className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                    {pkg.services.map((s) => (
                      <li key={s} className="flex items-center gap-2">
                        <span className="text-emerald-600 font-bold">✓</span> {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  Active Tier
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Payment History List */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
              <IconCalendar width={20} height={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Payment History</h3>
          </div>

          <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200/60">
            {account.payments.length} transactions
          </span>
        </div>

        {account.payments.length === 0 ? (
          <p className="py-8 text-center text-xs font-medium text-slate-400">
            No payments recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {account.payments.slice(0, 10).map((payment) => {
              const badge = parseDateBadge(payment.createdAt);
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-4 py-3.5 first:pt-4 last:pb-0"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex min-w-[3.5rem] shrink-0 flex-col items-center justify-center rounded-xl border border-blue-100/80 bg-blue-50 py-1.5 px-1 text-blue-600">
                      <span className="text-sm font-extrabold leading-none">{badge.day}</span>
                      <span className="text-[10px] font-bold uppercase leading-tight mt-0.5 text-center whitespace-nowrap">{badge.month}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-900">
                        {money(payment.amount)}
                      </div>
                      <div className="text-[11.5px] text-slate-500 font-medium truncate mt-0.5">
                        {PAYMENT_MODE_LABEL[payment.mode]} · {payment.kind === 'ADVANCE' ? 'Security Advance' : 'Monthly Subscription'}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        payment.status === 'CONFIRMED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : payment.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {payment.status === 'CONFIRMED'
                        ? 'Confirmed'
                        : payment.status === 'PENDING'
                          ? 'Pending Confirmation'
                          : 'Declined'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
