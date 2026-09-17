import Link from 'next/link';
import { BrandMark } from '@/components/shell/Brand';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-card text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-800">
          <BrandMark size={32} />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-navy-950">
          404 — Page Not Found
        </h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          The page or resource you are looking for doesn’t exist, was moved, or you don’t have access to view it.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Link
            href="/"
            className="flex w-full items-center justify-center rounded-xl bg-gold-500 py-3 text-sm font-semibold text-navy-950 shadow-md hover:bg-gold-400 transition-all"
          >
            Return to Home
          </Link>
          <Link
            href="/login"
            className="flex w-full items-center justify-center rounded-xl border border-line bg-slate-50 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all"
          >
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
