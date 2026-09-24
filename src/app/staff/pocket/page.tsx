import {
  Note,
  Row,
} from '@/components/ui/primitives';
import {
  IconInfo,
  IconRupee,
  IconWallet,
} from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { pocketAllowance } from '@/lib/services/payroll';
import { currentCycle, money } from '@/lib/util/format';
import { PocketForm } from './PocketForm';
import { StaffPocketHistory } from './StaffPocketHistory';

export const metadata = { title: 'Pocket Money' };

export default async function StaffPocket() {
  const session = await requirePermission('pocket:request');
  const store = await getStore();
  const staffId = session.user.staffId!;
  const firstName = session.user.name.split(' ')[0] || 'Staff';

  const [allowance, rules, requests] = await Promise.all([
    pocketAllowance(store, staffId, currentCycle()),
    store.getPayoutSettings(),
    store.pocketRequests.find({
      where: { staffId },
      orderBy: [{ field: 'requestedAt', dir: 'desc' }],
      limit: 50,
    }),
  ]);

  const hasPending = requests.some((r) => r.status === 'PENDING');

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
              Request advance pocket money anytime based on your verified monthly earnings.
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Available to withdraw */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-100/80 bg-emerald-50 text-emerald-600">
              <IconWallet width={24} height={24} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                AVAILABLE TO WITHDRAW
              </div>
              <div className="mt-0.5 text-2xl font-black tracking-tight text-emerald-600">
                {money(allowance.available)}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                Instantly requestable right now
              </div>
            </div>
          </div>
        </div>

        {/* In Your Account */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-100/80 bg-blue-50 text-blue-600">
              <IconRupee width={24} height={24} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                TOTAL EARNED IN ACCOUNT
              </div>
              <div className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">
                {money(allowance.inAccount)}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                Earned this cycle, not yet paid
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Request Withdrawal Form Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
            <IconRupee width={20} height={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Request a Withdrawal</h3>
            <p className="text-xs text-slate-500">
              Enter amount to submit request to your area manager.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <PocketForm available={allowance.available} hasPending={hasPending} />
        </div>
      </div>

      {/* 4. The Rules Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
            <IconInfo width={20} height={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Pocket Money Limits & Rules</h3>
            <p className="text-xs text-slate-500">Safety rules so you always have salary left at month-end</p>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <Row
            label="Weekly withdrawal limit"
            value={`${rules.pocketWeeklyCapPercent}% of earnings`}
          />
          <Row label="Weekly limit in rupees" value={money(allowance.weeklyCap)} />
          <Row label="Withdrawn this week" value={money(allowance.takenThisWeek)} />
          <Row
            label="Must stay in account (buffer)"
            value={money(rules.pocketMinimumBalance)}
          />
          <Row
            label="Available right now"
            value={money(allowance.available)}
            tone="success"
          />
        </div>

        <div className="mt-4">
          <Note>
            Whatever you take now is deducted from your monthly payout. The minimum balance rule is there so you always have something left on salary day.
          </Note>
        </div>
      </div>

      {/* 5. Past Requests List with Filters */}
      <StaffPocketHistory requests={requests} />
    </div>
  );
}
