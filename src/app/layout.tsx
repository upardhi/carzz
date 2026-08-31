import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OnlineStatus } from '@/components/pwa/OnlineStatus';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorker';
import './globals.css';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Carz Management';

// next/font downloads and self-hosts these at build time, so there is no
// render-blocking request to a font CDN on a phone with poor signal. It also
// generates the size-adjusted "Geist Fallback" face, which is what stops the
// layout shifting before the webfont paints.
const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

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
    <html
      lang="en-IN"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <OnlineStatus />
        {children}
        <InstallPrompt />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
