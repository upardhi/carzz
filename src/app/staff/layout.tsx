import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { StaffShell } from '@/components/shell/StaffShell';
import { requireSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

export default async function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();
  if (!session.user.staffId) redirect('/');

  // Fetch the area name in parallel — it's a fast single-row lookup.
  const store = await getStore();
  const area = session.user.areaId
    ? await store.areas.get(session.user.areaId)
    : null;

  // Use a fixed locale + timeZone so server and client produce the same string.
  // `new Date()` with Intl.DateTimeFormat using a pinned locale is stable;
  // calling formatDateFull() (which uses the runtime default locale) caused
  // hydration mismatches when the server and browser locale settings differed.
  const subtitle = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());

  return (
    <StaffShell
      staffName={session.user.name}
      areaName={area?.name}
      subtitle={subtitle}
    >
      {children}
    </StaffShell>
  );
}

