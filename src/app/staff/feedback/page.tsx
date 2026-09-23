import { IconStar } from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import { formatClock, formatDateFull } from '@/lib/util/format';
import { washDurationMinutes, formatDurationMinutes } from '@/lib/util/washTiming';

export const metadata = { title: 'My Feedback' };

export default async function StaffFeedback() {
  const session = await requirePermission('self:jobs');
  const store = await getStore();
  const staffId = session.user.staffId!;
  const firstName = session.user.name.split(' ')[0] || 'Staff';

  // A generous window, not a hard cycle boundary — a wash boy should be able
  // to see how they've been doing over time, not just this month.
  const recentVisits = await store.visits.find({
    where: { staffId, status: 'DONE' } as never,
    orderBy: [{ field: 'completedAt', dir: 'desc' }],
    limit: 300,
  });

  // Never show who left the feedback — a wash boy identifying the customer
  // behind a low rating is exactly the conflict this list exists to avoid.
  const feedback = recentVisits.map((v) => {
    const duration = washDurationMinutes(v);
    return {
      id: v.id,
      dateLabel: formatDateFull(v.completedAt || v.scheduledDate),
      timeLabel: v.completedAt ? formatClock(v.completedAt) : v.scheduledTime,
      startedAtLabel: v.startedAt ? formatClock(v.startedAt) : null,
      completedAtLabel: v.completedAt ? formatClock(v.completedAt) : null,
      durationLabel: duration !== null ? formatDurationMinutes(duration) : null,
      servicesDone: v.servicesDone || [],
      beforePhotoUrl: resolvePublicPhotoUrl(v.beforePhotoUrl),
      afterPhotoUrl: resolvePublicPhotoUrl(v.afterPhotoUrl),
      rating: v.rating,
      comment: v.ratingComment,
      managerRating: v.managerRating,
      managerComment: v.managerRatingComment,
      onTime: v.onTime,
    };
  });

  const customerRated = feedback.filter((f) => f.rating !== null);
  const avgRating = customerRated.length
    ? customerRated.reduce((s, f) => s + (f.rating ?? 0), 0) / customerRated.length
    : null;
  const lowRatedCount = customerRated.filter((f) => (f.rating ?? 5) < 3).length;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#071329] via-[#0d2247] to-[#123164] p-6 text-white shadow-md border border-navy-800/60">
        <div className="relative z-10">
          <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl text-white flex items-center gap-2">
            Hello, {firstName}! <span className="animate-wiggle">👋</span>
          </h2>
          <p className="mt-1 text-xs md:text-sm text-slate-300 font-medium max-w-xl">
            Every rating and comment customers and managers left on your washes.
            Names are never shown here — only the feedback.
          </p>
        </div>
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            AVERAGE CUSTOMER RATING
          </div>
          <div className="mt-0.5 text-2xl font-black tracking-tight text-amber-600">
            {avgRating !== null ? `${avgRating.toFixed(1)} ★` : '—'}
          </div>
          <div className="mt-0.5 text-xs font-medium text-slate-500">
            From {customerRated.length} customer review{customerRated.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            TOTAL FEEDBACK
          </div>
          <div className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">
            {feedback.length}
          </div>
          <div className="mt-0.5 text-xs font-medium text-slate-500">Washes with feedback</div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            BELOW 3★
          </div>
          <div className={`mt-0.5 text-2xl font-black tracking-tight ${lowRatedCount ? 'text-rose-600' : 'text-emerald-600'}`}>
            {lowRatedCount}
          </div>
          <div className="mt-0.5 text-xs font-medium text-slate-500">
            {lowRatedCount ? 'Talk to your manager about these' : 'None — keep it up'}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-600">
            <IconStar width={20} height={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Feedback History</h3>
            <p className="text-xs text-slate-500">Most recent first — what was done on that wash, and how it was rated</p>
          </div>
        </div>

        {feedback.length === 0 ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-500">
            No feedback recorded yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {feedback.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 text-xs"
              >
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{f.dateLabel}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 font-medium">Done at {f.completedAtLabel || f.timeLabel}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    {f.startedAtLabel && f.completedAtLabel ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200/80 px-2 py-0.5 text-slate-700 shadow-2xs">
                        <span>⏱</span> {f.startedAtLabel} → {f.completedAtLabel}
                        {f.durationLabel ? <span className="font-bold text-slate-900">({f.durationLabel})</span> : null}
                      </span>
                    ) : f.durationLabel ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200/80 px-2 py-0.5 text-slate-700 shadow-2xs">
                        <span>⏱</span> Took <span className="font-bold text-slate-900">{f.durationLabel}</span>
                      </span>
                    ) : null}

                    {f.onTime ? (
                      <span className="rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        ✓ On-time
                      </span>
                    ) : null}
                  </div>
                </div>

                {f.servicesDone.length > 0 ? (
                  <div className="mb-2.5 flex flex-wrap gap-1">
                    {f.servicesDone.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs"
                      >
                        <span className="text-emerald-600">✓</span> {s}
                      </span>
                    ))}
                  </div>
                ) : null}

                {(f.beforePhotoUrl || f.afterPhotoUrl) && (
                  <div className="mb-2.5 grid grid-cols-2 gap-2">
                    {f.beforePhotoUrl ? (
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.beforePhotoUrl}
                          alt="Before wash photo"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                          Before
                        </span>
                      </div>
                    ) : null}
                    {f.afterPhotoUrl ? (
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.afterPhotoUrl}
                          alt="After wash photo"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                          After
                        </span>
                      </div>
                    ) : null}
                  </div>
                )}

                {f.rating !== null ? (
                  <div
                    className={`text-[11.5px] p-2 rounded-lg border ${
                      f.rating < 3
                        ? 'bg-rose-50 border-rose-200/60 text-rose-700'
                        : 'bg-white border-slate-200/60 text-slate-600'
                    }`}
                  >
                    <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Customer
                    </span>
                    <span className="font-bold mr-1.5">{'★'.repeat(f.rating)}</span>
                    {f.comment ? <span>&ldquo;{f.comment}&rdquo;</span> : null}
                  </div>
                ) : (
                  <div className="text-[11px] px-2 py-1.5 rounded-lg border border-dashed border-slate-200 bg-white/60 text-slate-400 font-medium">
                    No customer rating left yet
                  </div>
                )}

                {f.managerRating !== null ? (
                  <div className="mt-1.5 text-[11.5px] text-slate-600 bg-blue-50 p-2 rounded-lg border border-blue-200/60">
                    <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-500">
                      Manager
                    </span>
                    <span className="text-amber-500 font-bold mr-1.5">
                      {'★'.repeat(f.managerRating)}
                    </span>
                    {f.managerComment ? <span>&ldquo;{f.managerComment}&rdquo;</span> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
