'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker and activates a waiting update on the next
 * page load, so field staff never sit on a stale build for days.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
      if ('caches' in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
      return;
    }

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let refreshing = false;

    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange,
    );

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              installing.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch(() => {
        // A failed registration must never break the app — it just means no
        // offline support on this device.
      });

    return () =>
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      );
  }, []);

  return null;
}
