/**
 * Typed locally rather than importing from '@capacitor/cli', so the web build
 * does not depend on a package only needed when producing store builds.
 * `npx cap` reads this file directly and validates it itself.
 */
interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: { url?: string; cleartext?: boolean; androidScheme?: string };
  android?: { allowMixedContent?: boolean };
  ios?: { contentInset?: string };
  plugins?: Record<string, Record<string, unknown>>;
}

/**
 * Native shell for the Play Store and App Store.
 *
 * The PWA is the product — installable from the browser, works offline, no
 * store review to ship a fix. Capacitor exists only for the cases a store
 * listing is genuinely required, and it wraps the very same codebase: there
 * is no second app to keep in step.
 *
 * Two ways to run it, chosen by how you want updates to reach phones:
 *
 *   server.url (default below)
 *     The native shell loads the live deployment. Ship a fix by deploying the
 *     web app; phones pick it up on next launch, no store submission. This is
 *     the recommended mode, and the only one where the server-rendered pages
 *     and API routes work as they do on the web.
 *
 *   bundled
 *     Comment out `server.url` and build with MOBILE_EXPORT=1, which switches
 *     next.config.mjs to a static export the shell loads from disk. The app
 *     then needs NEXT_PUBLIC_API_ORIGIN pointing at your deployment for data,
 *     and every change needs a new store build.
 */
const config: CapacitorConfig = {
  appId: 'ai.carzz.app',
  appName: 'Carz',
  webDir: 'out',
  server: {
    // Point this at your deployment before running `npx cap sync`.
    url: process.env.MOBILE_SERVER_URL ?? 'https://carzz.example.com',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    // The wash flow opens the camera; a captured photo must not be lost to a
    // background eviction while the boy is still standing at the car.
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#0a1f3d',
      showSpinner: false,
    },
  },
};

export default config;
