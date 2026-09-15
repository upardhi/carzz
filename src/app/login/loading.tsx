/**
 * login/loading.tsx
 * Shown by Next.js as a Suspense fallback while the login page server
 * component is resolving (e.g. reading the session cookie).
 * Prevents the 1-second blank white flash when an already-logged-in
 * user hits /login and gets redirected to their dashboard.
 */
export default function LoginLoading() {
  return (
    <main className="min-h-[100dvh] bg-navy-900 lg:grid lg:grid-cols-2 animate-pulse">
      {/* Brand panel skeleton */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 p-10 lg:flex">
        {/* Logo placeholder */}
        <div className="h-8 w-32 rounded-lg bg-white/10" />

        <div className="space-y-4">
          <div className="h-4 w-24 rounded-full bg-white/10" />
          <div className="h-10 w-3/4 rounded-lg bg-white/10" />
          <div className="h-4 w-full rounded-lg bg-white/10" />
          <div className="h-4 w-5/6 rounded-lg bg-white/10" />
          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3.5 w-full rounded bg-white/10" />
                <div className="h-2.5 w-4/5 rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>

        <div className="h-3 w-40 rounded bg-white/10" />
      </section>

      {/* Form panel skeleton */}
      <section className="flex min-h-[100dvh] items-center justify-center px-5 py-10 lg:min-h-0 lg:bg-white">
        <div className="w-full max-w-sm space-y-4">
          {/* Card */}
          <div className="rounded-card border border-navy-600 bg-navy-850 p-6 shadow-raised lg:border-line lg:bg-white space-y-4">
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-white/10" />
            <div className="h-6 w-36 rounded bg-slate-200 dark:bg-white/10" />
            <div className="h-3 w-full rounded bg-slate-200 dark:bg-white/10" />

            {/* Input placeholders */}
            <div className="space-y-3 pt-2">
              <div className="h-10 w-full rounded-lg bg-slate-100 dark:bg-white/10" />
              <div className="h-10 w-full rounded-lg bg-slate-100 dark:bg-white/10" />
              <div className="h-10 w-full rounded-xl bg-slate-200 dark:bg-white/20" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
