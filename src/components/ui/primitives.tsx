import clsx from 'clsx';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { StatCard, StatGrid, type StatTone, type SubtextTone } from './StatCard';

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export type CardTone =
  | 'default'
  | 'brand'
  | 'success'
  | 'gold'
  | 'danger'
  | 'navy';

const CARD_TONES: Record<CardTone, string> = {
  default: 'border-line bg-white',
  brand: 'border-navy-200 bg-navy-50',
  success: 'border-success-200 bg-success-50',
  gold: 'border-gold-200 bg-gold-50',
  danger: 'border-danger-300 bg-danger-50',
  navy: 'border-navy-700 bg-navy-850 text-white',
};

export function Card({
  tone = 'default',
  accent,
  className,
  children,
  ...rest
}: ComponentProps<'div'> & { tone?: CardTone; accent?: CardTone }) {
  const ACCENT: Record<CardTone, string> = {
    default: 'border-l-4 border-l-line-strong',
    brand: 'border-l-4 border-l-navy-800',
    success: 'border-l-4 border-l-success-500',
    gold: 'border-l-4 border-l-gold-500',
    danger: 'border-l-4 border-l-danger-500',
    navy: 'border-l-4 border-l-navy-700',
  };
  return (
    <div
      {...rest}
      className={clsx(
        'rounded-card border p-4.5 shadow-card',
        CARD_TONES[tone],
        accent && ACCENT[accent],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
      {children}
    </h3>
  );
}

export function AccountCard({
  monthlyAmount,
  isPaid = true,
  statusLabel,
  className,
}: {
  monthlyAmount: number;
  isPaid?: boolean;
  statusLabel?: string;
  className?: string;
}) {
  const displayStatus = statusLabel || (isPaid ? 'All paid up' : 'Due soon');
  return (
    <div
      className={clsx(
        'rounded-2xl border border-[#a7f3d0] bg-[#ecfdf5] p-5 flex items-center justify-between shadow-sm transition-all',
        className,
      )}
    >
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d1fae5] text-[#059669]">
          <svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
            <rect x="3" y="7" width="18" height="12" rx="2" />
            <circle cx="16.5" cy="13" r="1.2" />
          </svg>
        </div>
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#065f46]">
            ACCOUNT
          </div>
          <div className="text-sm font-semibold text-[#047857] mt-0.5">
            Monthly package
          </div>
        </div>
      </div>

      <div className="text-right flex flex-col items-end">
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-[#d1fae5] px-2.5 py-0.5 text-[11px] font-semibold text-[#047857] mb-1">
          {displayStatus}
        </span>
        <div className="text-xl lg:text-2xl font-bold tracking-tight text-[#064e3b]">
          ₹{monthlyAmount.toLocaleString('en-IN')}
        </div>
      </div>
    </div>
  );
}

/** Big figure inside a card — the number a user is meant to read first. */
export function Stat({
  value,
  tone = 'default',
  sub,
}: {
  value: ReactNode;
  tone?: 'default' | 'brand' | 'success' | 'gold' | 'danger';
  sub?: ReactNode;
}) {
  const TONE = {
    default: 'text-ink',
    brand: 'text-navy-800',
    success: 'text-success-600',
    gold: 'text-gold-600',
    danger: 'text-danger-500',
  };
  return (
    <div>
      <div className={clsx('text-2xl font-bold tracking-tight', TONE[tone])}>
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-ink-mute">{sub}</div> : null}
    </div>
  );
}

/** A labelled row — the workhorse of every detail panel. */
export function Row({
  label,
  value,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'brand' | 'success' | 'gold' | 'danger';
}) {
  const TONE = {
    brand: 'text-navy-800',
    success: 'text-success-600',
    gold: 'text-gold-600',
    danger: 'text-danger-500',
  };
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-dashed border-line-soft py-1.5 text-sm last:border-0 min-w-0">
      <span className="text-ink-mute shrink-0">{label}</span>
      <span className={clsx('text-right font-semibold break-words min-w-0', tone && TONE[tone])}>
        {value}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tag                                                                        */
/* -------------------------------------------------------------------------- */

export type TagTone = 'ok' | 'warn' | 'bad' | 'neutral' | 'info';

const TAG_TONES: Record<TagTone, string> = {
  ok: 'bg-success-100 text-success-700',
  warn: 'bg-gold-100 text-gold-700',
  bad: 'bg-danger-100 text-danger-600',
  neutral: 'bg-surface-raised text-ink-soft',
  info: 'bg-navy-100 text-navy-800',
};

export function Tag({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: TagTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center whitespace-nowrap rounded-pill px-2 py-0.5 text-[10.5px] font-semibold tracking-wide',
        TAG_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-navy-800 text-white hover:bg-navy-700 disabled:bg-line-strong',
  secondary:
    'bg-white text-navy-800 border border-line-strong hover:bg-surface-muted disabled:text-ink-faint',
  ghost: 'text-navy-800 hover:bg-navy-50 disabled:text-ink-faint',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 disabled:bg-line-strong',
  gold: 'bg-gold-500 text-white hover:bg-gold-600 disabled:bg-line-strong',
  success: 'bg-success-600 text-white hover:bg-success-700 disabled:bg-line-strong',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-[15px]',
};

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors ' +
  'disabled:cursor-not-allowed active:translate-y-px';

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  className,
  ...rest
}: ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}) {
  return (
    <button
      {...rest}
      className={clsx(
        BUTTON_BASE,
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    />
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  block,
  className,
  ...rest
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}) {
  return (
    <Link
      {...rest}
      className={clsx(
        BUTTON_BASE,
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Layout helpers                                                             */
/* -------------------------------------------------------------------------- */

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between gap-3 border-b border-line pb-1.5 first:mt-0">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Note({
  tone = 'gold',
  children,
}: {
  tone?: 'gold' | 'brand' | 'success' | 'danger';
  children: ReactNode;
}) {
  const TONES = {
    gold: 'bg-gold-50 border-gold-200 text-gold-700',
    brand: 'bg-navy-50 border-navy-200 text-navy-800',
    success: 'bg-success-50 border-success-200 text-success-700',
    danger: 'bg-danger-50 border-danger-300 text-danger-600',
  };
  return (
    <div className={clsx('rounded-lg border p-3 text-xs leading-relaxed', TONES[tone])}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-white px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {hint ? <p className="mt-1 text-sm text-ink-mute">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** KPI tile grid used across every console dashboard — renders modern StatGrid */
export function KpiGrid({
  children,
  columns = 6,
  className,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  return (
    <StatGrid columns={columns} className={className}>
      {children}
    </StatGrid>
  );
}

/** Modern KPI metric card with icon box, value, and dynamic subtext */
export function Kpi({
  label,
  value,
  tone = 'default',
  hint,
  icon,
  subtext,
  subtextTone,
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'brand' | 'success' | 'gold' | 'danger' | StatTone;
  hint?: ReactNode;
  icon?: ReactNode;
  subtext?: ReactNode;
  subtextTone?: SubtextTone;
  className?: string;
}) {
  return (
    <StatCard
      label={label}
      value={value}
      tone={tone as StatTone}
      hint={hint}
      subtext={subtext}
      subtextTone={subtextTone}
      icon={icon}
      className={className}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="scroll-x">
      <div className="min-w-full overflow-hidden rounded-card border border-line bg-white shadow-card">
        {children}
      </div>
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return <table className="w-full border-collapse text-[13px]">{children}</table>;
}

export function Th({ children, className }: ComponentProps<'th'>) {
  return (
    <th
      className={clsx(
        'whitespace-nowrap bg-surface-raised px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-navy-500',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...rest }: ComponentProps<'td'>) {
  return (
    <td {...rest} className={clsx('border-t border-line-soft px-3 py-2 align-middle', className)}>
      {children}
    </td>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

export function Progress({
  value,
  max,
  tone = 'brand',
}: {
  value: number;
  max: number;
  tone?: 'brand' | 'success' | 'gold' | 'danger';
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const TONE = {
    brand: 'bg-navy-800',
    success: 'bg-success-500',
    gold: 'bg-gold-500',
    danger: 'bg-danger-500',
  };
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-raised"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div className={clsx('h-full rounded-pill', TONE[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Simple bar chart — no charting library, no client JS. */
export function BarChart({
  data,
  tone = 'brand',
}: {
  data: { label: string; value: number }[];
  tone?: 'brand' | 'gold';
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const TONE = { brand: 'bg-navy-800', gold: 'bg-gold-500' };
  return (
    <div>
      <div className="flex h-20 items-end gap-1.5">
        {data.map((d) => (
          <div
            key={d.label}
            className={clsx('flex-1 rounded-t', TONE[tone])}
            style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
            title={`${d.label}: ${d.value}`}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-[9.5px] text-ink-faint">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export { StatCard, StatGrid } from './StatCard';
export type { StatCardProps, StatTone, SubtextTone } from './StatCard';


