import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import { homeFor } from '@/lib/auth/rbac';

/** The root simply routes each signed-in role to its own console. */
export default async function RootPage() {
  const session = await getSession();
  redirect(session ? homeFor(session.user.role) : '/login');
}
