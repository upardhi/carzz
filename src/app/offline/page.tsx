import { BrandMark } from '@/components/shell/Brand';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-navy-900 px-6 text-center text-white">
      <BrandMark size={64} />
      <h1 className="mt-5 text-xl font-extrabold">You are offline</h1>
      <p className="mt-2 max-w-sm text-sm text-navy-300">
        Carz will reload the moment your connection is back. Anything you
        already opened is still available from this device.
      </p>
    </main>
  );
}
