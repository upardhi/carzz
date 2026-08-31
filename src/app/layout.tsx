import type { Metadata, Viewport } from 'next';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OnlineStatus } from '@/components/pwa/OnlineStatus';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorker';
import './globals.css';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Carz Management';

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description:
    'Car wash operations — schedules, wash proof, payments and payouts across every area.',
  applicationName: APP_NAME,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Carz',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0f1e2a',
  width: 'device-width',
  initialScale: 1,
  // Installed apps should not rubber-band or zoom on a double tap, but pinch
  // zoom stays available so the accessibility escape hatch is intact.
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN">
      <body>
        <OnlineStatus />
        {children}
        <InstallPrompt />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
