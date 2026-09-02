'use client';

import clsx from 'clsx';
import type { ComponentProps, ReactNode } from 'react';

export type StatTone =
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'purple'
  | 'sky'
  | 'slate'
  | 'navy';

const TONE_STYLES: Record<
  StatTone,
  { iconBg: string; iconColor: string; valueColor?: string }
> = {
  blue: { iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
  emerald: { iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  amber: { iconBg: 'bg-amber-50', iconColor: 'text-amber-600', valueColor: 'text-amber-600' },
  rose: { iconBg: 'bg-rose-50', iconColor: 'text-rose-600' },
  purple: { iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
  sky: { iconBg: 'bg-sky-50', iconColor: 'text-sky-600' },
  slate: { iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
  navy: { iconBg: 'bg-navy-100', iconColor: 'text-navy-700' },
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

export interface StatCardProps extends ComponentProps<'div'> {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  subtext?: ReactNode;
  subtextTone?: SubtextTone;
  customValueColor?: string;
}

/**
 * Modern, accessible KPI metric card with icon box, value, and dynamic subtext.
 */
export function StatCard({
  label,
  value,
  icon,
  tone = 'blue',
  subtext,
  subtextTone = 'muted',
  customValueColor,
  className,
  ...rest
}: StatCardProps) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.blue;
  const subtextClass = SUBTEXT_STYLES[subtextTone] || SUBTEXT_STYLES.muted;

  return (
    <div
      {...rest}
      className={clsx(
        'flex flex-col justify-between rounded-xl border border-line-soft bg-white p-4 shadow-sm transition-all hover:border-navy-200',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {icon ? (
          <div
            className={clsx(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              styles.iconBg,
              styles.iconColor,
            )}
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
            {label}
          </div>
          <div
            className={clsx(
              'truncate text-2xl font-black',
              customValueColor || styles.valueColor || 'text-navy-950',
            )}
          >
            {value}
          </div>
        </div>
      </div>

      {subtext ? (
        <div className={clsx('mt-2 text-[11px]', subtextClass)}>
          {subtext}
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
