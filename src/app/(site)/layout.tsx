import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getStore } from '@/lib/data';

/** SEO copy comes from the record the Super Admin edits, not from code. */
export async function generateMetadata(): Promise<Metadata> {
  const site = await (await getStore()).getSiteContent();
  return {
    title: { absolute: site.seoTitle },
    description: site.seoDescription,
    openGraph: {
      title: site.seoTitle,
      description: site.seoDescription,
      type: 'website',
    },
    robots: site.published ? undefined : { index: false, follow: false },
  };
}

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#packages', label: 'Packages' },
  { href: '#why', label: 'Why Carz' },
  { href: '#reviews', label: 'Reviews' },
  { href: '#book', label: 'Book' },
];

export default async function SiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const site = await (await getStore()).getSiteContent();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f8fafc] text-slate-900 selection:bg-amber-500 selection:text-navy-950">
      {/* ----------------- Top Navigation Bar ----------------- */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#071739] backdrop-blur-md shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3.5 sm:px-6 py-3">
          {/* Brand Logo matching target mockup */}
          <Link href="/" aria-label="Carz Home" className="flex items-center gap-2.5 shrink-0 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-[#071739] shadow-sm shrink-0">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2" />
                <circle cx="7" cy="17" r="2" />
                <path d="M9 17h6" />
                <circle cx="17" cy="17" r="2" />
              </svg>
            </div>
            <div>
              <span className="text-base sm:text-lg font-bold tracking-tight text-white block leading-none">CARZ</span>
              <span className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 block mt-0.5">
                CAR WASH
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main Site Navigation">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[13px] font-semibold text-slate-200 transition-colors hover:text-amber-400"
              >
                {item.label}
              </a>
            ))}
            <a
              href="#book"
              className="text-[13px] font-semibold text-slate-200 transition-colors hover:text-amber-400"
            >
              Help
            </a>
          </nav>

          {/* Right Area: Sign In Button */}
          <div className="flex items-center shrink-0">
            <Link
              href="/login"
              className="whitespace-nowrap shrink-0 rounded-xl bg-white px-3.5 py-1.5 sm:px-4 sm:py-1.5 text-xs font-semibold text-[#071739] shadow-sm hover:bg-slate-100 active:scale-95 transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* ----------------- Main Content ----------------- */}
      <main className="flex-1 pb-16 md:pb-0">{children}</main>

      {/* ----------------- Mobile Bottom Navigation Bar ----------------- */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-white/10 bg-[#081429]/95 px-2 backdrop-blur-lg md:hidden"
      >
        <a
          href="#"
          className="flex flex-col items-center gap-1 text-[11px] font-bold text-amber-400"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Home</span>
        </a>

        <a
          href="#packages"
          className="flex flex-col items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span>Packages</span>
        </a>

        {/* Elevated Center Book Button */}
        <a
          href="#book"
          className="-mt-5 flex h-14 w-14 flex-col items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-[#081429] shadow-lg shadow-amber-500/30 transition-transform active:scale-95"
          aria-label="Book Wash Now"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="text-[9px] font-bold uppercase">Book</span>
        </a>

        <a
          href="#areas"
          className="flex flex-col items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>Areas</span>
        </a>

        <Link
          href="/login"
          className="flex flex-col items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Profile</span>
        </Link>
      </nav>

      {/* ----------------- Footer ----------------- */}
      <footer className="border-t border-[#1e3a6a]/40 bg-[#061021] px-5 py-12 text-slate-400">
        <div className="mx-auto grid w-full max-w-7xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-[#081429]">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2" />
                  <circle cx="7" cy="17" r="2" />
                  <path d="M9 17h6" />
                  <circle cx="17" cy="17" r="2" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white">CARZ</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              {site.seoDescription || 'Premium doorstep car wash with before & after photo proof of every single wash.'}
            </p>
          </div>

          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-amber-400">
              Talk to us
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a className="hover:text-white transition-colors" href={`tel:${site.phone.replace(/\s/g, '')}`}>
                  📞 {site.phone}
                </a>
              </li>
              <li>
                <a
                  className="hover:text-emerald-400 transition-colors"
                  href={`https://wa.me/${site.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  💬 WhatsApp: {site.whatsapp}
                </a>
              </li>
              <li>
                <a className="hover:text-white transition-colors" href={`mailto:${site.email}`}>
                  ✉️ {site.email}
                </a>
              </li>
              <li className="text-xs text-slate-500">📍 {site.addressLine}</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-amber-400">
              Quick Links
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a className="hover:text-white transition-colors" href={item.href}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-amber-400">
              Customer Portal
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Sign in to view your wash schedule, before & after photos, and subscription status.
            </p>
            <Link
              href="/login"
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs sm:text-sm font-semibold text-[#081429] shadow-md hover:bg-amber-400 transition-all"
            >
              Open My Account →
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-10 w-full max-w-7xl border-t border-white/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p suppressHydrationWarning>© {new Date().getFullYear()} Carz Doorstep Wash. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-300">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-300">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

