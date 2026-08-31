import type { NavGroup } from '@/components/shell/ConsoleShell';
import {
  IconAlert,
  IconBox,
  IconCalendar,
  IconChart,
  IconChat,
  IconCog,
  IconGrid,
  IconMap,
  IconRupee,
  IconUser,
  IconUsers,
} from '@/components/shell/icons';

export interface NavCounts {
  unassigned?: number;
  redAlerts?: number;
  openComplaints?: number;
  pocketRequests?: number;
  lowStock?: number;
  pendingPurchases?: number;
}

/** Manager and Area Admin run the same screens; only the base path differs. */
export function operationsNav(base: string, counts: NavCounts): NavGroup[] {
  return [
    {
      heading: 'Today',
      items: [
        { href: base, label: 'Dashboard', icon: <IconGrid width={18} height={18} /> },
        {
          href: `${base}/schedule`,
          label: 'Schedule',
          icon: <IconCalendar width={18} height={18} />,
          badge: counts.unassigned,
        },
      ],
    },
    {
      heading: 'Customers',
      items: [
        { href: `${base}/customers`, label: 'All customers', icon: <IconUsers width={18} height={18} /> },
        {
          href: `${base}/alerts`,
          label: 'Red alerts',
          icon: <IconAlert width={18} height={18} />,
          badge: counts.redAlerts,
        },
        {
          href: `${base}/complaints`,
          label: 'Complaints',
          icon: <IconChat width={18} height={18} />,
          badge: counts.openComplaints,
        },
      ],
    },
    {
      heading: 'Team & stock',
      items: [
        {
          href: `${base}/staff`,
          label: 'Staff',
          icon: <IconUser width={18} height={18} />,
          badge: counts.pocketRequests,
        },
        {
          href: `${base}/inventory`,
          label: 'Inventory',
          icon: <IconBox width={18} height={18} />,
          badge: counts.lowStock,
        },
      ],
    },
  ];
}

/** Extra sections only an Area Admin sees, on top of the operations nav. */
export function regionNav(counts: NavCounts): NavGroup[] {
  return [
    ...operationsNav('/area', counts),
    {
      heading: 'Region',
      items: [
        { href: '/area/areas', label: 'Areas', icon: <IconMap width={18} height={18} /> },
        { href: '/area/managers', label: 'Managers', icon: <IconUsers width={18} height={18} /> },
        { href: '/area/reports', label: 'Reports', icon: <IconChart width={18} height={18} /> },
      ],
    },
  ];
}

export function adminNav(counts: NavCounts): NavGroup[] {
  return [
    {
      heading: 'Business',
      items: [
        { href: '/admin', label: 'Overview', icon: <IconGrid width={18} height={18} /> },
        { href: '/admin/areas', label: 'Areas', icon: <IconMap width={18} height={18} /> },
        { href: '/admin/reports', label: 'Reports', icon: <IconChart width={18} height={18} /> },
        { href: '/admin/sources', label: 'Lead sources', icon: <IconChart width={18} height={18} /> },
      ],
    },
    {
      heading: 'Money',
      items: [
        { href: '/admin/payout', label: 'Staff payout', icon: <IconRupee width={18} height={18} /> },
        { href: '/admin/accounting', label: 'Accounting', icon: <IconRupee width={18} height={18} /> },
        { href: '/admin/packages', label: 'Packages', icon: <IconBox width={18} height={18} /> },
      ],
    },
    {
      heading: 'Operations',
      items: [
        {
          href: '/admin/inventory',
          label: 'Inventory',
          icon: <IconBox width={18} height={18} />,
          badge: counts.pendingPurchases,
        },
        {
          href: '/admin/complaints',
          label: 'Complaints',
          icon: <IconChat width={18} height={18} />,
          badge: counts.openComplaints,
        },
      ],
    },
    {
      heading: 'Setup',
      items: [
        { href: '/admin/users', label: 'People & roles', icon: <IconUsers width={18} height={18} /> },
        { href: '/admin/settings', label: 'Settings', icon: <IconCog width={18} height={18} /> },
      ],
    },
  ];
}
