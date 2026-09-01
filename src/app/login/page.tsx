import { redirect } from 'next/navigation';
import { BrandLockup } from '@/components/shell/Brand';
import { homeFor } from '@/lib/auth/rbac';
import { getSession } from '@/lib/auth/server';
import { DemoAccounts, LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await getSession();
  if (session && !next) {
    redirect(homeFor(session.user.role));
  }

  return (
    <main className="min-h-[100dvh] bg-navy-900 lg:grid lg:grid-cols-2">
      {/* Brand panel — hidden on phones, where the form is the whole screen. */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 p-10 lg:flex">
        {/* Faint grid, as on the reference panel */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-navy-grid bg-grid opacity-70"
        />
        <BrandLockup subtitle="Management" className="relative" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-pill border border-gold-500/50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-gold-500">
            Every wash, on record
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-white">
            Run every area.
            <br />
            <span className="text-gold-500">Prove every wash.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">
            Carz gives each wash boy his route and his earnings, each customer
            their schedule and proof, and the owner the profit per area — from
            one system that works on the phone in their pocket.
          </p>

          <dl className="mt-8 grid max-w-md grid-cols-3 gap-4 border-t border-navy-700 pt-6">
            {[
              ['Photo-verified', 'every wash'],
              ['5 roles', 'one platform'],
              ['Works offline', 'installable'],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-sm font-extrabold text-white">{value}</dt>
                <dd className="text-[11px] uppercase tracking-wide text-navy-300">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-[11px] text-navy-400">
          © {new Date().getFullYear()} Carz Management
        </p>
      </section>

      <section className="flex min-h-[100dvh] items-center justify-center px-5 py-10 lg:min-h-0 lg:bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <BrandLockup subtitle="Management" className="mb-8 justify-center" />
          </div>

          <div className="rounded-card border border-navy-600 bg-navy-850 p-6 shadow-raised lg:border-line lg:bg-white">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-navy-300 lg:text-navy-800">
              Welcome back
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-white lg:text-ink">
              Sign in to Carz
            </h2>
            <p className="mb-5 mt-1 text-sm text-slate-300 lg:text-ink-mute">
              Use the account your manager set up for you.
            </p>

            <div className="[&_.field-label]:text-navy-300 lg:[&_.field-label]:text-ink-soft">
              <LoginForm next={next} />
            </div>
          </div>

          <DemoAccounts />
        </div>
      </section>
    </main>
  );
}
