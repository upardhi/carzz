import { PageHeader } from '@/components/shell/ConsoleShell';
import { Card } from '@/components/ui/primitives';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { formatDateFull, money } from '@/lib/util/format';
import { ActionButton } from './ActionButton';

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  AREA_APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
};

/** Referral leads a wash boy submitted — needs sign-off from both the area
 * admin and the super admin before the bonus is honored. Mounted only under
 * /admin and /area; a plain manager does not see this. */
export async function ConsoleReferrals({ session }: { session: Session }) {
  const store = await getStore();
  const areaFilter = scopeAreaFilter(session.scope);

  const [referrals, staff, rules] = await Promise.all([
    store.staffReferrals.find({
      where: areaFilter as never,
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    }),
    store.staff.find(),
    store.getPayoutSettings(),
  ]);

  const staffById = new Map(staff.map((s) => [s.id, s]));
  const isSuperAdmin = session.user.role === 'SUPER_ADMIN';

  const pending = referrals.filter((r) => r.status === 'PENDING' || r.status === 'AREA_APPROVED');
  const approved = referrals.filter((r) => r.status === 'APPROVED');
  const rejected = referrals.filter((r) => r.status === 'REJECTED');

  return (
    <>
      <PageHeader
        title="Referrals"
        description="Leads a wash boy named — needs both an area admin and the owner to sign off"
      />

      <div className="my-4">
        <StatGrid columns={3}>
          <StatCard
            label="AWAITING SIGN-OFF"
            value={pending.length}
            tone={pending.length ? 'amber' : 'emerald'}
            subtext="Needs approval"
          />
          <StatCard
            label="APPROVED"
            value={approved.length}
            tone="emerald"
            subtext="Bonus pays automatically once they join"
          />
          <StatCard label="REJECTED" value={rejected.length} tone="slate" subtext="Not honored" />
        </StatGrid>
      </div>

      {referrals.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-500">
          No referrals submitted yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {referrals.map((r) => {
            const referrer = staffById.get(r.referredByStaffId);
            const bonus = r.type === 'CUSTOMER' ? rules.carReferralBonus : rules.staffReferralBonus;
            const myApprovalGiven = isSuperAdmin
              ? Boolean(r.superApprovedByUserId)
              : Boolean(r.areaApprovedByUserId);
            const canAct = r.status !== 'APPROVED' && r.status !== 'REJECTED' && !myApprovalGiven;

            return (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{r.name}</span>
                      <span className="text-slate-400 text-xs">{r.phone}</span>
                      <span className="rounded-md bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600">
                        {r.type === 'CUSTOMER' ? 'Customer' : 'Wash boy'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Referred by <span className="font-semibold text-slate-700">{referrer?.name ?? '—'}</span>
                      {' · '}
                      {formatDateFull(r.createdAt)} · Bonus if they join: {money(bonus)}
                    </p>
                    {r.note ? <p className="mt-1 text-xs italic text-slate-500">&ldquo;{r.note}&rdquo;</p> : null}
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className={r.areaApprovedByUserId ? 'text-emerald-600 font-semibold' : ''}>
                        {r.areaApprovedByUserId ? '✓ Area admin approved' : '○ Awaiting area admin'}
                      </span>
                      <span>·</span>
                      <span className={r.superApprovedByUserId ? 'text-emerald-600 font-semibold' : ''}>
                        {r.superApprovedByUserId ? '✓ Owner approved' : '○ Awaiting owner'}
                      </span>
                    </div>
                    {r.status === 'REJECTED' && r.rejectionReason ? (
                      <p className="mt-1.5 text-xs text-rose-600">Reason: {r.rejectionReason}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${STATUS_TONE[r.status]}`}
                    >
                      {r.status.replace('_', ' ')}
                    </span>
                    {canAct ? (
                      <>
                        <ActionButton
                          endpoint="/api/ops/referrals"
                          variant="success"
                          payload={{ action: 'approve', referralId: r.id }}
                        >
                          Approve
                        </ActionButton>
                        <ActionButton
                          endpoint="/api/ops/referrals"
                          variant="danger"
                          payload={{ action: 'reject', referralId: r.id, reason: 'Not approved.' }}
                          confirm={`Reject the referral for ${r.name}?`}
                        >
                          Reject
                        </ActionButton>
                      </>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
