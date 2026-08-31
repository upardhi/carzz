import { ConsoleInventory } from '@/components/console/Inventory';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Inventory' };

export default async function AreaInventory() {
  const session = await requirePermission('inventory:view');
  return <ConsoleInventory session={session} />;
}
