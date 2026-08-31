import { Button, Card, CardHeading, Note, Row } from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import {
  currentCycle,
  formatClock,
  formatDateFull,
  percent,
  todayISO,
} from '@/lib/util/format';
import { LanguagePicker } from './LanguagePicker';

export const metadata = { title: 'Profile' };

export default async function StaffProfile() {
  const session = await requirePermission('self:jobs');
  const store = await getStore();
  const staffId = session.user.staffId!;
  const cycle = currentCycle();

  const [staff, settings, visits, todayAttendance] = await Promise.all([
    store.staff.get(staffId),
    store.getAppSettings(),
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

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <CardHeading>My details</CardHeading>
        <Row label="Name" value={staff?.name ?? session.user.name} />
        <Row label="Mobile" value={staff?.phone ?? session.user.phone} />
        <Row label="Area" value={area?.name ?? '—'} />
        <Row label="Manager" value={manager?.name ?? '—'} />
        <Row
          label="Joined"
          value={staff ? formatDateFull(staff.joinedOn) : '—'}
        />
        <Row
          label="Signed in today"
          value={
            todayAttendance?.loginAt
              ? formatClock(todayAttendance.loginAt)
              : 'Not yet recorded'
          }
          tone={todayAttendance?.loginAt ? 'success' : 'gold'}
        />
      </Card>

      <Card className="p-4">
        <CardHeading>App language</CardHeading>
        <LanguagePicker
          current={session.user.language}
          options={settings.languages}
        />
      </Card>

      <Card className="p-4">
        <CardHeading>My performance this month</CardHeading>
        <Row label="Washes done" value={done.length} />
        <Row
          label="On-time rate"
          value={percent(done.length ? done.filter((v) => v.onTime).length / done.length : 0)}
          tone="success"
        />
        <Row
          label="Average rating"
          value={
            rated.length
              ? `${(rated.reduce((s, v) => s + (v.rating ?? 0), 0) / rated.length).toFixed(1)} ★`
              : 'Not rated yet'
          }
        />
        <Row
          label="Missed washes"
          value={visits.filter((v) => v.status === 'MISSED').length}
        />
      </Card>

      <Note tone="success">
        A tea break of {settings.teaBreakMinutes} minutes is allowed. Tell your
        manager if you need longer.
      </Note>

      <form action="/api/auth/logout" method="post">
        <Button type="submit" variant="secondary" block>
          Sign out
        </Button>
      </form>
    </div>
  );
}
