# Shipping Carz to phones

Carz is a PWA first. That is a deliberate choice, not a shortcut.

## The PWA is the app

Opening the site on a phone and tapping **Install** (Android/Chrome) or
**Share → Add to Home Screen** (iOS/Safari) gives a real app icon, a
full-screen app with no browser chrome, and offline support. The in-app
banner prompts for this automatically.

What this buys you over a store app:

- **Fixes ship the same day.** No review queue. A wash boy on a broken build
  is fixed by a deploy, not a resubmission.
- **Nothing to install for staff turnover.** A new boy opens a link.
- **One codebase.** No second app drifting out of step with the web.

Offline behaviour is tuned for field use: the app shell is cached, pages fall
back to the last version loaded, and API reads are served from cache when the
signal drops. A wash boy who loaded his round at the depot still has it in a
basement car park.

## When you need a store listing

Some clients want an App Store / Play Store entry. `capacitor.config.ts`
wraps the same codebase in a native shell.

```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/android @capacitor/ios

# Point the shell at your deployment
export MOBILE_SERVER_URL=https://your-deployment.example.com

npx cap add android      # and/or: npx cap add ios
npm run cap:sync
npm run cap:android      # opens Android Studio
```

By default the shell loads your live deployment, so you still ship fixes by
deploying and only touch the stores when the shell itself changes. Read the
comments at the top of `capacitor.config.ts` for the fully-bundled
alternative and what it costs you.

`/android` and `/ios` are generated directories and are gitignored — they are
recreated by `npx cap add`.

## Camera

The wash flow uses a plain `<input type="file" accept="image/*"
capture="environment">`. That opens the native camera on both Android and
iOS, in the browser and inside the Capacitor shell, with no plugin. If you
later want gallery restrictions or background upload, add
`@capacitor/camera` and swap the input — the upload endpoint does not change.
