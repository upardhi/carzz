import { IconGift } from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { formatDateFull } from '@/lib/util/format';
import { ReferralForm } from './ReferralForm';

export const metadata = { title: 'Refer & Earn' };

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Waiting for review',
  AREA_APPROVED: 'One approval in — waiting on the other',
  APPROVED: 'Fully approved',
  REJECTED: 'Rejected',
};

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  AREA_APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default async function StaffReferPage() {
  const session = await requirePermission('referral:submit');
  const store = await getStore();
  const staffId = session.user.staffId!;
  const [rules, referrals] = await Promise.all([
    store.getPayoutSettings(),
    store.staffReferrals.find({
      where: { referredByStaffId: staffId },
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#071329] via-[#0d2247] to-[#123164] p-6 text-white shadow-md border border-navy-800/60">
        <div className="relative z-10">
          <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl text-white flex items-center gap-2">
            Refer &amp; Earn <span>🎁</span>
          </h2>
          <p className="mt-1 text-xs md:text-sm text-slate-300 font-medium max-w-xl">
            Know someone who wants a car wash, or someone looking for wash-boy work?
            Tell us here — your area admin and the owner both review it, and once
            approved the bonus is paid automatically the month they join.
          </p>
        </div>
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            NEW CUSTOMER REFERRAL
          </div>
          <div className="mt-0.5 text-2xl font-black tracking-tight text-emerald-600">
            ₹{rules.carReferralBonus}
          </div>
          <div className="mt-0.5 text-xs font-medium text-slate-500">Paid when they join</div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            NEW WASH BOY REFERRAL
          </div>
          <div className="mt-0.5 text-2xl font-black tracking-tight text-emerald-600">
            ₹{rules.staffReferralBonus}
          </div>
          <div className="mt-0.5 text-xs font-medium text-slate-500">Paid when they join</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-bold text-base">
            <IconGift width={18} height={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Submit a Referral
            </h3>
            <p className="text-xs text-slate-500">Name and phone are enough to get started</p>
          </div>
        </div>
        <ReferralForm />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <h3 className="text-base font-bold text-slate-900">Your Referrals</h3>
        </div>
        {referrals.length === 0 ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-500">
            You haven&apos;t submitted any referrals yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {referrals.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900">{r.name}</span>
                    <span className="ml-2 text-slate-500">{r.phone}</span>
                  </div>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="rounded-md bg-white border border-slate-200 px-1.5 py-0.5 font-semibold text-slate-600">
                    {r.type === 'CUSTOMER' ? 'Customer' : 'Wash boy'}
                  </span>
                  <span>Submitted {formatDateFull(r.createdAt)}</span>
                </div>
                {r.note ? <p className="mt-1.5 text-slate-500 italic">&ldquo;{r.note}&rdquo;</p> : null}
                {r.status === 'REJECTED' && r.rejectionReason ? (
                  <p className="mt-1.5 text-rose-600">Reason: {r.rejectionReason}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
