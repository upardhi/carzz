'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/shell/Brand';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    console.error('Captured Application Error:', error);

    const checkOnline = () => setIsOffline(!navigator.onLine);
    checkOnline();
    window.addEventListener('online', checkOnline);
    window.addEventListener('offline', checkOnline);
    return () => {
      window.removeEventListener('online', checkOnline);
      window.removeEventListener('offline', checkOnline);
    };
  }, [error]);

  const isDbOrNetworkError =
    isOffline ||
    !navigator.onLine ||
    error.message?.includes('database') ||
    error.message?.includes('db.prisma.io') ||
    error.message?.includes('fetch failed') ||
    error.message?.includes('ETIMEDOUT') ||
    error.message?.includes('ECONNREFUSED') ||
    error.message?.includes('offline') ||
    error.message?.includes('PrismaClient');

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-navy-900 px-4 py-8 text-center text-white">
      <div className="w-full max-w-md rounded-2xl border border-navy-700 bg-navy-850 p-6 sm:p-8 shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-800 border border-navy-700">
          {isDbOrNetworkError ? (
            <svg
              className="h-7 w-7 text-gold-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          ) : (
            <BrandMark size={32} />
          )}
        </div>

        <h1 className="mt-5 text-xl font-bold tracking-tight text-white sm:text-2xl">
          {isDbOrNetworkError
            ? 'Connection Interrupted'
            : 'Something went wrong'}
        </h1>

        <p className="mt-2.5 text-sm text-navy-300 leading-relaxed">
          {isDbOrNetworkError
            ? 'You appear to be offline or the server connection was temporarily lost. Any previously cached data is saved safely.'
            : 'An unexpected error occurred while loading this page. You can retry or head back to your dashboard.'}
        </p>

        {isDbOrNetworkError && (
          <div className="mt-4 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3.5 py-2.5 text-xs font-semibold text-gold-300">
            Offline Mode active · Actions will sync when reconnected
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              reset();
              window.location.reload();
            }}
            className="flex w-full items-center justify-center rounded-xl bg-gold-500 py-3 text-sm font-semibold text-navy-950 shadow-md transition-all hover:bg-gold-400 active:scale-[0.98]"
          >
            Retry Connection
          </button>

          <Link
            href="/offline"
            className="flex w-full items-center justify-center rounded-xl border border-navy-700 bg-navy-800 py-3 text-sm font-bold text-navy-200 transition-all hover:bg-navy-750 hover:text-white"
          >
            View Offline Center
          </Link>

          <Link
            href="/"
            className="mt-1 text-xs font-semibold text-navy-400 hover:text-navy-200 transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
