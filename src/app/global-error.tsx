'use client';

import { BrandMark } from '@/components/shell/Brand';

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (typeof console !== 'undefined') {
    console.error('Captured Global Error:', _error);
  }
  return (
    <html lang="en">
      <body className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#081429] px-4 py-8 text-center text-white font-sans">
        <div className="w-full max-w-md rounded-2xl border border-[#1e3a6a] bg-[#0e203f] p-6 sm:p-8 shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#081429] border border-[#1e3a6a]">
            <BrandMark size={32} />
          </div>

          <h1 className="mt-5 text-xl font-bold tracking-tight text-white sm:text-2xl">
            Offline / Connection Issue
          </h1>

          <p className="mt-2.5 text-sm text-[#94a3b8] leading-relaxed">
            The application could not reach the server or database. If you are offline, cached data remains accessible.
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                reset();
                window.location.reload();
              }}
              className="flex w-full items-center justify-center rounded-xl bg-[#e8a317] py-3 text-sm font-semibold text-[#081429] shadow-md hover:bg-[#f5c453] transition-all"
            >
              Retry Connection
            </button>

            <a
              href="/offline"
              className="flex w-full items-center justify-center rounded-xl border border-[#1e3a6a] bg-[#081429] py-3 text-sm font-bold text-[#94a3b8] hover:text-white transition-all"
            >
              Open Offline Center
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
