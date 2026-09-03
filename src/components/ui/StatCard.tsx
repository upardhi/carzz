import clsx from 'clsx';
import type { ComponentProps, ReactNode } from 'react';
import {
  IconAlert,
  IconBox,
  IconCar,
  IconChart,
  IconCheckCircle,
  IconClock,
  IconRupee,
  IconTrendingUp,
  IconUser,
  IconUsers,
  IconWallet,
} from '@/components/shell/icons';

export type StatTone =
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'purple'
  | 'sky'
  | 'slate'
  | 'navy'
  | 'gold'
  | 'danger'
  | 'success'
  | 'brand'
  | 'default';

const TONE_STYLES: Record<
  string,
  { iconBg: string; iconColor: string; valueColor?: string }
> = {
  blue: { iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
  emerald: { iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  success: { iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  amber: { iconBg: 'bg-amber-50', iconColor: 'text-amber-600', valueColor: 'text-amber-600' },
  gold: { iconBg: 'bg-amber-50', iconColor: 'text-amber-600', valueColor: 'text-amber-600' },
  rose: { iconBg: 'bg-rose-50', iconColor: 'text-rose-600', valueColor: 'text-rose-600' },
  danger: { iconBg: 'bg-rose-50', iconColor: 'text-rose-600', valueColor: 'text-rose-600' },
  purple: { iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
  sky: { iconBg: 'bg-sky-50', iconColor: 'text-sky-600' },
  slate: { iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
  navy: { iconBg: 'bg-navy-100', iconColor: 'text-navy-700' },
  brand: { iconBg: 'bg-navy-100', iconColor: 'text-navy-700' },
  default: { iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
};

export type SubtextTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'muted';

const SUBTEXT_STYLES: Record<SubtextTone, string> = {
  success: 'text-emerald-600 font-semibold',
  warning: 'text-amber-600 font-semibold',
  danger: 'text-rose-600 font-semibold',
  info: 'text-blue-600 font-medium',
  neutral: 'text-purple-600 font-medium',
  muted: 'text-ink-mute font-medium',
};

function autoDetectIcon(label: string, tone?: string): ReactNode {
  const l = label.toLowerCase();
  if (l.includes('customer') || l.includes('client') || l.includes('people')) {
    return <IconUsers width={20} height={20} strokeWidth={2} />;
  }
  if (l.includes('car') || l.includes('vehicle')) {
    return <IconCar width={20} height={20} strokeWidth={2} />;
  }
  if (
    l.includes('staff') ||
    l.includes('wash boy') ||
    l.includes('manager') ||
    l.includes('user') ||
    l.includes('unassigned')
  ) {
    return <IconUser width={20} height={20} strokeWidth={2} />;
  }
  if (
    l.includes('rupee') ||
    l.includes('₹') ||
    l.includes('bill') ||
    l.includes('collect') ||
    l.includes('paid') ||
    l.includes('revenue') ||
    l.includes('outstanding') ||
    l.includes('earned')
  ) {
    return <IconRupee width={20} height={20} strokeWidth={2.2} />;
  }
  if (
    l.includes('wallet') ||
    l.includes('pocket') ||
    l.includes('payout') ||
    l.includes('cost') ||
    l.includes('deposit') ||
    l.includes('expense') ||
    l.includes('price')
  ) {
    return <IconWallet width={20} height={20} strokeWidth={2} />;
  }
  if (
    l.includes('stock') ||
    l.includes('item') ||
    l.includes('inventory') ||
    l.includes('goods') ||
    l.includes('request')
  ) {
    return <IconBox width={20} height={20} strokeWidth={2} />;
  }
  if (
    l.includes('done') ||
    l.includes('complete') ||
    l.includes('active') ||
    l.includes('on-time')
  ) {
    return <IconCheckCircle width={20} height={20} strokeWidth={2} />;
  }
  if (
    l.includes('miss') ||
    l.includes('alert') ||
    l.includes('lost') ||
    l.includes('churn') ||
    l.includes('out of stock') ||
    l.includes('order now') ||
    l.includes('danger') ||
    l.includes('urgent')
  ) {
    return <IconAlert width={20} height={20} strokeWidth={2} />;
  }
  if (
    l.includes('clock') ||
    l.includes('hour') ||
    l.includes('time') ||
    l.includes('day') ||
    l.includes('pending') ||
    l.includes('not done')
  ) {
    return <IconClock width={20} height={20} strokeWidth={2} />;
  }
  if (
    l.includes('margin') ||
    l.includes('profit') ||
    l.includes('rate') ||
    l.includes('efficiency')
  ) {
    return <IconTrendingUp width={20} height={20} strokeWidth={2} />;
  }

  // Fallback by tone
  if (tone === 'rose' || tone === 'danger') {
    return <IconAlert width={20} height={20} strokeWidth={2} />;
  }
  if (tone === 'amber' || tone === 'gold') {
    return <IconClock width={20} height={20} strokeWidth={2} />;
  }
  if (tone === 'emerald' || tone === 'success') {
    return <IconCheckCircle width={20} height={20} strokeWidth={2} />;
  }
  return <IconChart width={20} height={20} strokeWidth={2} />;
}

export interface StatCardProps extends ComponentProps<'div'> {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  subtext?: ReactNode;
  hint?: ReactNode;
  subtextTone?: SubtextTone;
  customValueColor?: string;
}

/**
 * Modern, accessible KPI metric card with icon box, value, and dynamic subtext.
 * Matches design from screenshot with responsive layout.
 */
export function StatCard({
  label,
  value,
  icon,
  tone = 'blue',
  subtext,
  hint,
  subtextTone,
  customValueColor,
  className,
  ...rest
}: StatCardProps) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.blue;
  const resolvedSubtext = subtext ?? hint;

  const resolvedSubtextTone: SubtextTone =
    subtextTone ||
    (tone === 'danger' || tone === 'rose'
      ? 'danger'
      : tone === 'gold' || tone === 'amber'
        ? 'warning'
        : tone === 'success' || tone === 'emerald'
          ? 'success'
          : tone === 'blue'
            ? 'info'
            : 'muted');

  const subtextClass = SUBTEXT_STYLES[resolvedSubtextTone] || SUBTEXT_STYLES.muted;
  const resolvedIcon = icon !== undefined ? icon : autoDetectIcon(label, tone);

  return (
    <div
      {...rest}
      className={clsx(
        'flex flex-col justify-between rounded-2xl border border-line-soft bg-white p-4 shadow-sm transition-all hover:border-navy-200 hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {resolvedIcon ? (
          <div
            className={clsx(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              styles.iconBg,
              styles.iconColor,
            )}
          >
            {resolvedIcon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
            {label}
          </div>
          <div
            className={clsx(
              'truncate text-2xl font-black tracking-tight',
              customValueColor || styles.valueColor || 'text-navy-950',
            )}
          >
            {value}
          </div>
        </div>
      </div>

      {resolvedSubtext ? (
        <div className={clsx('mt-2 text-[11px] font-medium leading-tight', subtextClass)}>
          {resolvedSubtext}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Responsive grid container for StatCards.
 */
export function StatGrid({
  children,
  columns = 6,
  className,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  const colClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  }[columns];

  return (
    <div className={clsx('grid gap-3.5', colClass, className)}>
      {children}
    </div>
  );
}
