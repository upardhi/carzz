'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'carzz.install.dismissed';

/**
 * "Add to Home screen" banner.
 *
 * Chrome and Edge fire `beforeinstallprompt`, so those get a real install
 * button. iOS Safari fires nothing and has no install API, so it gets the
 * Share → Add to Home Screen instruction instead — without it, iPhone users
 * simply never discover that this can be an app icon.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // Private mode can throw on access; treat it as "not dismissed".
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const ua = window.navigator.userAgent;
    const isIosSafari =
      /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIosSafari) setIosHint(true);

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* nothing to persist to — the banner just returns next visit */
    }
    setDeferred(null);
    setIosHint(false);
  };

  // The banner is fixed, so without reserving space it silently covers
  // whatever sits at the bottom of the page — on the customer's car list that
  // was the "View wash history" button, which simply stopped responding.
  const visible = Boolean(deferred) || iosHint;
  useEffect(() => {
    const root = document.documentElement;
    if (visible) root.dataset.installBanner = '1';
    else delete root.dataset.installBanner;
    return () => {
      delete root.dataset.installBanner;
    };
  }, [visible]);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md rounded-card border border-navy-700 bg-navy-850 p-3 text-white shadow-raised sm:bottom-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Install Carz on your phone</p>
          <p className="mt-0.5 text-xs text-navy-300">
            {deferred
              ? 'Open it from your home screen, works offline.'
              : 'Tap Share, then “Add to Home Screen”.'}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {deferred ? (
            <button
              type="button"
              onClick={install}
              className="rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-extrabold text-navy-900"
            >
              Install
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded-lg border border-navy-600 px-2.5 py-1.5 text-xs font-bold text-navy-300"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
