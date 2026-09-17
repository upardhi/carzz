'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect, type ReactNode } from 'react';
import { BrandLockup } from './Brand';
import { IconLogout, IconMenu } from './icons';

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Count badge — unassigned cars, pending approvals, and the like. */
  badge?: number;
}

export interface NavGroup {
  heading: string;
  items: NavItem[];
}

/**
 * The desktop console shell for Manager, Area Admin and Super Admin.
 *
 * The sidebar collapses behind a menu button under `lg`, so a manager can run
 * her area from a phone at the gate and from a laptop at the desk without a
 * second set of screens.
 */
export function ConsoleShell({
  roleLabel,
  scopeLabel,
  userName,
  nav,
  children,
}: {
  roleLabel: string;
  scopeLabel: string;
  userName: string;
  nav: NavGroup[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('carzz_last_portal', pathname.startsWith('/console') ? pathname : '/console');
      localStorage.setItem('carzz_portal', 'console');
    } catch {
      // ignore
    }
  }, [pathname]);

  // The section index (`/manager`) is a prefix of every page beneath it, so a
  // plain startsWith would light two items at once. Pick the single longest
  // href that matches instead. Hrefs carrying a query string (e.g. the "Boys"
  // shortcut, `/admin/users?role=EMPLOYEE`) must match pathname + search
  // exactly, so a role-filtered link doesn't light up for every role.
  const currentSearch = searchParams.toString();
  const currentFull = currentSearch ? `${pathname}?${currentSearch}` : pathname;
  const activeHref = nav
    .flatMap((group) => group.items.map((item) => item.href))
    .filter((href) => {
      const [hrefPath] = href.split('#');
      if (hrefPath.includes('?')) return hrefPath === currentFull;
      return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
    })
    .sort((a, b) => b.length - a.length)[0];

  const sidebar = (
    <div className="flex h-full flex-col bg-gradient-to-b from-navy-850 to-navy-950">
      <div className="border-b border-navy-700 px-4 py-4" suppressHydrationWarning>
        <div className="flex items-center justify-between" suppressHydrationWarning>
          <BrandLockup subtitle={roleLabel} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-lg bg-navy-800 text-navy-300 hover:bg-navy-700 hover:text-white lg:hidden",
              !open && "hidden"
            )}
            suppressHydrationWarning
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mt-3 rounded-lg border border-navy-700 bg-navy-900 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-navy-300">
            Scope
          </div>
          <div className="truncate text-sm font-bold text-white">{scopeLabel}</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Sections">
        {nav.map((group) => (
          <div key={group.heading} className="mb-4">
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-navy-500">
              {group.heading}
            </div>
            {group.items.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors',
                    active
                      ? 'bg-gold-500 text-navy-950 font-bold shadow-sm'
                      : 'text-navy-200/80 hover:bg-navy-700 hover:text-white',
                  )}
                >
                  <span aria-hidden>{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span
                      className={clsx(
                        'rounded-pill px-1.5 py-0.5 text-[10px] font-semibold',
                        active ? 'bg-navy-900 text-gold-400' : 'bg-danger-500 text-white',
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-navy-700 p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-navy-900 px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-600 text-xs font-semibold text-white">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-white">{userName}</div>
            <div className="text-[10.5px] text-navy-300">{roleLabel}</div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              aria-label="Sign out"
              className="rounded-lg p-1.5 text-navy-500 hover:bg-navy-700 hover:text-white"
            >
              <IconLogout width={18} height={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-surface-sunken lg:flex">
      <aside className="hidden w-64 shrink-0 lg:sticky lg:top-0 lg:block lg:h-[100dvh]">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm transition-opacity"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-navy-700 bg-navy-900 px-4 py-3 pt-safe text-white lg:hidden" suppressHydrationWarning>
          <div className="flex items-center gap-3" suppressHydrationWarning>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-800 text-gold-400 border border-navy-700 hover:bg-navy-750 hover:border-gold-500/50 transition-all shadow-sm active:scale-95"
            >
              <IconMenu width={20} height={20} />
            </button>
            <BrandLockup subtitle={roleLabel} />
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-700 text-xs font-bold text-white border border-navy-600"
              suppressHydrationWarning
            >
              {userName.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-3 sm:p-5">{children}</main>
      </div>
    </div>
  );
}

/** Page heading used inside the console body. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-sm text-ink-mute">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
