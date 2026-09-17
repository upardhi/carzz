import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { CustomerShell } from '@/components/shell/CustomerShell';
import { requireSession } from '@/lib/auth/server';

export default async function CustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();
  // A staff account has no customer record to show; middleware normally keeps
  // them out, but a role change mid-session would land here.
  if (!session.user.customerId) redirect('/');

  return (
    <CustomerShell
      userName={session.user.name}
      userPhone={session.user.phone}
    >
      {children}
    </CustomerShell>
  );
}
