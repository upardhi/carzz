import { IconGift } from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { formatDateFull } from '@/lib/util/format';
import { ReferralForm } from './ReferralForm';

export const metadata = { title: 'Refer & Earn' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 text-base">
              📋
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Your Referrals
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Track the review status and bonus payout for every referral you&apos;ve submitted
              </p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200">
            {referrals.length} {referrals.length === 1 ? 'Referral' : 'Referrals'}
          </span>
        </div>

        {referrals.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg shadow-2xs border border-slate-200/80">
              🎁
            </div>
            <p className="text-sm font-bold text-slate-700">
              No referrals submitted yet
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Submit a customer or wash boy referral above to earn a joining bonus.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {referrals.map((r) => {
              const isCustomer = r.type === 'CUSTOMER';
              const bonusAmount = isCustomer
                ? rules.carReferralBonus
                : rules.staffReferralBonus;

              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all hover:border-slate-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Left: Avatar + Person Info */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg ${
                          isCustomer
                            ? 'bg-blue-50 border-blue-100 text-blue-600'
                            : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                        }`}
                      >
                        {isCustomer ? '🚗' : '👷'}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            {r.name}
                          </h4>
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                              isCustomer
                                ? 'border-blue-200 bg-blue-50/70 text-blue-700'
                                : 'border-emerald-200 bg-emerald-50/70 text-emerald-700'
                            }`}
                          >
                            {isCustomer ? 'Customer' : 'Wash Boy'}
                          </span>
                          <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                            +₹{bonusAmount} Bonus
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                            <span>📞</span>
                            <span>{r.phone}</span>
                          </span>
                          <span className="text-slate-300 hidden sm:inline">•</span>
                          <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-500">
                            <span>📅</span>
                            <span>Submitted {formatDateFull(r.createdAt)}</span>
                          </span>
                        </div>

                        {r.note ? (
                          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
                            <span className="font-bold text-slate-500 shrink-0">
                              Note:
                            </span>
                            <span className="text-slate-700 break-words">
                              {r.note}
                            </span>
                          </div>
                        ) : null}

                        {r.status === 'REJECTED' && r.rejectionReason ? (
                          <div className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                            <span className="font-bold">Rejection reason:</span>{' '}
                            {r.rejectionReason}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Right: Status Pill */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold shadow-2xs ${STATUS_TONE[r.status]}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        <span>{STATUS_LABEL[r.status]}</span>
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        {r.status === 'APPROVED'
                          ? 'Bonus credited'
                          : r.status === 'REJECTED'
                            ? 'Not eligible'
                            : 'Paid upon joining'}
                      </span>
                    </div>
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
