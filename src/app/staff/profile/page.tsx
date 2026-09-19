import { Row } from '@/components/ui/primitives';
import {
  IconLogout,
  IconStar,
} from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import {
  currentCycle,
  formatClock,
  formatDateFull,
  percent,
  todayISO,
} from '@/lib/util/format';

export const metadata = { title: 'Staff Profile' };

export default async function StaffProfile() {
  const session = await requirePermission('self:jobs');
  const store = await getStore();
  const staffId = session.user.staffId!;
  const cycle = currentCycle();
  const firstName = session.user.name.split(' ')[0] || 'Staff';

  const [staff, visits, todayAttendance] = await Promise.all([
    store.staff.get(staffId),
    store.visits.find({ where: { staffId, cycle } }),
    store.attendance.findOne({ where: { staffId, date: todayISO() } }),
  ]);

  const [area, manager] = await Promise.all([
    staff?.areaId ? store.areas.get(staff.areaId) : null,
    staff?.areaId
      ? store.staff.findOne({ where: { areaId: staff.areaId, role: 'MANAGER' } })
      : null,
  ]);

  const done = visits.filter((v) => v.status === 'DONE');
  const rated = done.filter((v) => v.rating !== null);
  const missed = visits.filter((v) => v.status === 'MISSED');

  const initials = session.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'S';

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
              Your staff profile, assigned area, manager contact and performance stats.
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

      {/* 2. Profile Details Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-extrabold text-white shadow-sm">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{staff?.name ?? session.user.name}</h3>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-100">
                  Wash Staff
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 font-medium">
                {area?.name ? `${area.name} Area` : 'Assigned Route'} · Joined {staff ? formatDateFull(staff.joinedOn) : '—'}
              </p>
            </div>
          </div>

          {/* <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                todayAttendance?.loginAt
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {todayAttendance?.loginAt
                ? `Active Today (${formatClock(todayAttendance.loginAt)})`
                : 'Not Signed In Today'}
            </span>
          </div> */}
        </div>

        <div className="mt-4 space-y-1">
          <Row label="Mobile Number" value={staff?.phone ?? session.user.phone} />
          <Row label="Assigned Area" value={area?.name ?? '—'} />
          <Row label="Reporting Manager" value={manager?.name ?? '—'} />
          <Row
            label="Daily Attendance"
            value={
              todayAttendance?.loginAt
                ? `Clocked in at ${formatClock(todayAttendance.loginAt)}`
                : 'Pending daily attendance'
            }
            tone={todayAttendance?.loginAt ? 'success' : 'gold'}
          />
        </div>
      </div>

      {/* 3. Performance Stats Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
            <IconStar width={20} height={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Monthly Performance</h3>
            <p className="text-xs text-slate-500">Quality score, on-time percentage, and wash metrics</p>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <Row label="Washes completed this month" value={done.length} tone="success" />
          <Row
            label="On-time completion rate"
            value={percent(done.length ? done.filter((v) => v.onTime).length / done.length : 0)}
            tone="success"
          />
          <Row
            label="Customer satisfaction rating"
            value={
              rated.length > 0
                ? `${(rated.reduce((s, v) => s + (v.rating ?? 0), 0) / rated.length).toFixed(1)} ★ (${Math.round(
                  (rated.reduce((s, v) => s + (v.rating ?? 0), 0) / (rated.length * 5)) * 100,
                )}% satisfaction · ${rated.length} ${rated.length === 1 ? 'review' : 'reviews'})`
                : 'No customer reviews yet'
            }
            tone={rated.length > 0 ? 'gold' : undefined}
          />
          <Row
            label="Missed / Skipped washes"
            value={missed.length}
            tone={missed.length > 0 ? 'danger' : undefined}
          />
        </div>
      </div>

      {/* 4. Logout Action */}
      <div className="pt-2">
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 py-3 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
          >
            <IconLogout width={16} height={16} />
            <span>Sign Out of Account</span>
          </button>
        </form>
      </div>
    </div>
  );
}
