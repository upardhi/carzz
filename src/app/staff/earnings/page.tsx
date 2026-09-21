import Link from 'next/link';
import {
  BarChart,
  Note,
  Row,
} from '@/components/ui/primitives';
import {
  IconCheck,
  IconGift,
  IconRupee,
  IconStar,
  IconWallet,
} from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { computePayout } from '@/lib/services/payroll';
import { currentCycle, cycleLabel, money, percent } from '@/lib/util/format';

export const metadata = { title: 'My Earnings' };

export default async function StaffEarnings() {
  const session = await requirePermission('self:earnings');
  const store = await getStore();
  const staffId = session.user.staffId!;
  const cycle = currentCycle();
  const firstName = session.user.name.split(' ')[0] || 'Staff';

  // Six months of history so the trend is visible, not just this month's total.
  const cycles = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - (5 - i));
    return d.toISOString().slice(0, 7);
  });

  const cycleStart = `${cycle}-01`;
  const cycleEnd = `${cycle}-31`;
  const historyCycles = cycles.slice(0, 5); // the 5 months before current

  const [current, storedHistory, rules, _attendance, visits] = await Promise.all([
    computePayout(store, staffId, cycle),
    store.payouts.find({
      where: { staffId, cycle: { in: historyCycles } } as never,
    }),
    store.getPayoutSettings(),
    store.attendance.find({
      where: { staffId, date: { gte: cycleStart, lte: cycleEnd } as never },
    }),
    store.visits.find({ where: { staffId, cycle, status: 'DONE' } }),
  ]);

  // Build chart data: stored net for history, computed net for current month.
  const historyByC = new Map(storedHistory.map((p) => [p.cycle, p.net]));
  const chartValues = cycles.map((c) =>
    c === cycle ? current.net : (historyByC.get(c) ?? 0),
  );

  const rated = visits.filter((v) => v.rating !== null);
  const onTime = visits.filter((v) => v.onTime).length;

  const earnings = current.lines.filter((l) => l.kind === 'EARNING');
  const deductions = current.lines.filter((l) => l.kind === 'DEDUCTION');

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
              Track your salary, completed car wash slabs, and bonus rewards.
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
        {/* Net Payable */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-100/80 bg-emerald-50 text-emerald-600">
              <IconRupee width={24} height={24} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                EARNED THIS MONTH
              </div>
              <div className="mt-0.5 text-2xl font-black tracking-tight text-emerald-600">
                {money(current.net)}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                {cycleLabel(cycle)} · net payout
              </div>
            </div>
          </div>
        </div>

        {/* Washes Done */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-100/80 bg-blue-50 text-blue-600">
              <IconCheck width={24} height={24} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                WASHES DONE
              </div>
              <div className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">
                {visits.length}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                {percent(visits.length ? onTime / visits.length : 0)} on-time rate
              </div>
            </div>
          </div>
        </div>

        {/* Rating */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:col-span-1">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-100/80 bg-amber-50 text-amber-600">
              <IconStar width={24} height={24} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                AVERAGE RATING
              </div>
              <div className="mt-0.5 text-2xl font-black tracking-tight text-amber-600">
                {rated.length
                  ? `${(rated.reduce((s, v) => s + (v.rating ?? 0), 0) / rated.length).toFixed(1)} ★`
                  : '5.0 ★'}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                From customer reviews
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Monthly Earnings Trend Chart */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
              <IconWallet width={20} height={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">6-Month Earnings Trend</h3>
              <p className="text-xs text-slate-500">Monthly payout comparison</p>
            </div>
          </div>

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
            {money(current.net)} this month
          </span>
        </div>

        <div className="mt-6">
          <BarChart
            data={chartValues.map((net, i) => ({
              label: cycleLabel(cycles[i]).slice(0, 3),
              value: net,
            }))}
          />
        </div>
      </div>

      {/* 4. Earnings Breakdown / Slabs */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
            <IconRupee width={20} height={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">How It Adds Up</h3>
            <p className="text-xs text-slate-500">Detailed line items and deduction breakdown</p>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          {earnings.map((line) => (
            <Row
              key={line.label}
              label={
                <>
                  <span className="font-semibold text-slate-800">{line.label}</span>
                  {line.qty ? (
                    <span className="ml-1 text-slate-400 font-mono text-xs">× {line.qty}</span>
                  ) : null}
                </>
              }
              value={line.amount > 0 ? `+${money(line.amount)}` : money(0)}
              tone={line.amount > 0 ? 'success' : undefined}
            />
          ))}

          {deductions.length ? (
            <>
              <div className="my-3 border-t border-slate-100" />
              {deductions.map((line) => (
                <Row
                  key={line.label}
                  label={
                    <>
                      <span className="font-semibold text-slate-800">{line.label}</span>
                      {line.detail ? (
                        <span className="block text-[11px] text-slate-400">
                          {line.detail}
                        </span>
                      ) : null}
                    </>
                  }
                  value={`−${money(line.amount)}`}
                  tone="danger"
                />
              ))}
            </>
          ) : null}

          <div className="mt-4 flex items-baseline justify-between rounded-xl bg-slate-50 p-4 border border-slate-200/80">
            <span className="font-bold text-slate-900 text-sm">Net Payable Amount</span>
            <span className="text-xl font-black text-emerald-600">{money(current.net)}</span>
          </div>
        </div>
      </div>

      {/* 5. Refer & Earn Bonus Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple-100 bg-purple-50 text-purple-600">
            <IconGift width={20} height={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Refer and Earn Bonuses</h3>
            <p className="text-xs text-slate-500">Extra rewards automatically credited to your payout</p>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <Row
            label="A new customer car on your reference"
            value={money(rules.carReferralBonus)}
            tone="success"
          />
          <Row
            label="A new wash staff member on your reference"
            value={money(rules.staffReferralBonus)}
            tone="success"
          />
          <div className="mt-4">
            <Note tone="brand">
              Submit their name and phone in Refer &amp; Earn — once your area admin and the owner both approve it, the reward is added automatically the month they join.
            </Note>
          </div>
          <Link
            href="/staff/refer"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50/80 py-2.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors"
          >
            <IconGift width={14} height={14} />
            <span>Submit a Referral</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
