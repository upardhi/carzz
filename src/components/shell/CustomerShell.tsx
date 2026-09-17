'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import {
  IconBack,
  IconBell,
  IconCalendar,
  IconCar,
  IconChat,
  IconChevron,
  IconHome,
  IconLogout,
  IconSearch,
  IconWallet,
} from './icons';

import { BrandLockup } from './Brand';

export interface TabItem {
  href: string;
  label: string;
  icon: ReactNode;
}

interface NavSection {
  title?: string;
  items: {
    href: string;
    label: string;
    icon: ReactNode;
    exact?: boolean;
  }[];
}

const DESKTOP_NAV: NavSection[] = [
  {
    title: 'BUSINESS',
    items: [
      { href: '/app', label: 'Overview', icon: <IconHome width={18} height={18} />, exact: true },
      { href: '/app/cars', label: 'My Cars', icon: <IconCar width={18} height={18} /> },
      { href: '/app/payments', label: 'Payments', icon: <IconWallet width={18} height={18} /> },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { href: '/app/help', label: 'Help & Profile', icon: <IconChat width={18} height={18} /> },
    ],
  },
];

const MOBILE_TABS: TabItem[] = [
  { href: '/app', label: 'Home', icon: <IconHome /> },
  { href: '/app/cars', label: 'My Cars', icon: <IconCar /> },
  { href: '/app/payments', label: 'Payments', icon: <IconWallet /> },
  { href: '/app/help', label: 'Help', icon: <IconChat /> },
];

export function CustomerShell({
  userName,
  userPhone,
  back,
  children,
}: {
  userName: string;
  userPhone?: string;
  back?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    try {
      localStorage.setItem('carzz_last_portal', '/app');
      localStorage.setItem('carzz_portal', 'customer');
    } catch {
      // ignore
    }
  }, []);

  const firstName = userName.split(' ')[0] || 'User';
  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'U';

  const activeHref = DESKTOP_NAV
    .flatMap((section) => section.items)
    .map((item) => item.href)
    .filter((href) => pathname === href || (href !== '/app' && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0] || (pathname === '/app' ? '/app' : '');

  return (
    <div className="flex min-h-[100dvh] bg-[#f5f7fa] text-ink antialiased">
      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR (>= 1024px / lg)                                           */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex w-64 flex-col justify-between shrink-0 bg-gradient-to-b from-navy-850 to-navy-950 text-white select-none border-r border-navy-700 fixed inset-y-0 left-0 z-40">
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Brand Logo & Scope Header */}
          <div className="border-b border-navy-700 px-4 py-4">
            <BrandLockup subtitle="CUSTOMER" />
            <div className="mt-3 rounded-lg border border-navy-700 bg-navy-900 px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-navy-300">
                ACCOUNT
              </div>
              <div className="truncate text-sm font-bold text-white">
                {userName || 'Customer'}
              </div>
              {userPhone ? (
                <div className="truncate text-[11px] font-medium text-navy-400 mt-0.5">
                  +91 {userPhone}
                </div>
              ) : null}
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Customer Navigation">
            {DESKTOP_NAV.map((section, idx) => (
              <div key={idx} className="mb-4">
                {section.title && (
                  <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-navy-500">
                    {section.title}
                  </div>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = item.href === activeHref;

                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={clsx(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors',
                          active
                            ? 'bg-gold-500 text-white shadow-sm font-bold'
                            : 'text-navy-200/80 hover:bg-navy-700 hover:text-white',
                        )}
                      >
                        <span className={clsx(active ? 'text-white' : 'text-navy-300')}>
                          {item.icon}
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* User profile footer with direct Logout button at bottom */}
        <div className="border-t border-navy-700 p-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-navy-900 px-3 py-2 border border-navy-700/60">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-semibold text-white"
              suppressHydrationWarning
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1" suppressHydrationWarning>
              <div className="truncate text-[13px] font-bold text-white">{userName}</div>
              <div className="text-[10.5px] text-navy-300">Customer</div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-700 hover:text-white transition-colors"
              >
                <IconLogout width={18} height={18} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN LAYOUT WRAPPER                                                       */}
      {/* ========================================================================= */}
      <div className="flex flex-1 flex-col min-w-0 lg:pl-64">
        {/* DESKTOP TOP HEADER (>= 1024px) */}
        <header className="hidden lg:flex items-center justify-between bg-white px-8 py-3.5 sticky top-0 z-30 shadow-2xs border-b border-slate-200/80">
          {/* Search Bar */}
          <div className="relative max-w-md w-full">
            <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width={16} height={16} />
            <input
              type="text"
              placeholder="Search cars, bookings, or services..."
              className="w-full bg-[#f1f5f9] hover:bg-[#e2e8f0]/80 focus:bg-white rounded-full pl-9 pr-4 py-2 text-xs font-medium text-slate-700 placeholder:text-slate-400 border border-transparent focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-3.5">
            <Link
              href="/app/cars"
              className="flex items-center gap-2 bg-[#0a1931] hover:bg-[#12284c] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors"
            >
              <IconCalendar width={15} height={15} />
              <span>Book a Wash</span>
            </Link>

            <button
              type="button"
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60"
            >
              <IconBell width={17} height={17} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
            </button>

            <Link
              href="/app/help"
              className="flex items-center gap-2 rounded-full hover:bg-slate-100 pl-1.5 pr-2.5 py-1 text-xs font-semibold text-slate-800 transition-all border border-slate-200/60"
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1877f2] text-xs font-bold text-white shadow-2xs"
                suppressHydrationWarning
              >
                {initials}
              </div>
              <span className="truncate max-w-[120px]">{firstName}</span>
              <IconChevron width={11} height={11} className="rotate-90 text-slate-400" />
            </Link>
          </div>
        </header>

        {/* MOBILE STICKY TOP HEADER (< 1024px) */}
        <header className="lg:hidden sticky top-0 z-30 bg-[#0f2347] text-white shadow-raised pt-safe">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2.5">
              {back ? (
                <button
                  type="button"
                  onClick={() => router.back()}
                  aria-label="Go back"
                  className="-ml-1 rounded-lg p-1 text-navy-300 hover:bg-navy-800"
                >
                  <IconBack />
                </button>
              ) : null}
              <div className="min-w-0" suppressHydrationWarning>
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-[15px] font-bold tracking-tight text-white">
                    Hello, {firstName} 👋
                  </h1>
                </div>
                <p className="truncate text-[11px] text-navy-300 font-medium">
                  Your cars, schedule and payments
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                aria-label="Notifications"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800 text-navy-200"
              >
                <IconBell width={16} height={16} />
              </button>
              <Link
                href="/app/help"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-700 text-xs font-semibold text-white ring-1 ring-navy-500"
                suppressHydrationWarning
              >
                {initials}
              </Link>
            </div>
          </div>
        </header>

        {/* MAIN BODY CONTENT */}
        <main className="w-full flex-1 px-4 py-5 pb-28 md:px-6 md:py-6 lg:px-8 lg:py-7 lg:pb-12 max-w-6xl mx-auto">
          {children}
        </main>

        {/* MOBILE FIXED BOTTOM NAVIGATION (< 1024px) */}
        <nav
          className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-safe shadow-lg"
          aria-label="Mobile Bottom Navigation"
        >
          <div className="mx-auto flex w-full max-w-3xl">
            {MOBILE_TABS.map((tab) => {
              const active =
                pathname === tab.href ||
                (tab.href !== MOBILE_TABS[0].href && pathname.startsWith(`${tab.href}/`));
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold transition-colors',
                    active
                      ? 'text-[#214f92] shadow-[inset_0_2.5px_0_0_#214f92]'
                      : 'text-ink-mute hover:text-ink-soft',
                  )}
                >
                  <span aria-hidden className={clsx(active ? 'text-[#214f92]' : 'text-ink-mute')}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
