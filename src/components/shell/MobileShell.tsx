'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { IconBack } from './icons';

export interface TabItem {
  href: string;
  label: string;
  icon: ReactNode;
}

/**
 * The phone-first shell used by the customer and staff apps.
 *
 * Header and tab bar are fixed and the body scrolls between them, which is
 * what makes an installed PWA feel like a native app rather than a web page.
 */
export function MobileShell({
  title,
  subtitle,
  tabs,
  back,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  tabs: TabItem[];
  /** Show a back chevron instead of the title block's left padding. */
  back?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-sunken">
      <header className="sticky top-0 z-30 bg-navy-900 pt-safe text-white shadow-raised">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          {back ? (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="-ml-1 rounded-lg p-1 text-teal-300 hover:bg-navy-800"
            >
              <IconBack />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-extrabold tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-xs text-teal-300">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-3 pb-28 pt-3">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-safe"
        aria-label="Primary"
      >
        <div className="mx-auto flex w-full max-w-3xl">
          {tabs.map((tab) => {
            // The root tab must match exactly or it stays lit on every child page.
            const active =
              pathname === tab.href ||
              (tab.href !== tabs[0].href && pathname.startsWith(`${tab.href}/`));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-bold transition-colors',
                  active
                    ? 'text-teal-600 shadow-[inset_0_2px_0_0_currentColor]'
                    : 'text-ink-mute hover:text-ink-soft',
                )}
              >
                <span aria-hidden>{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
