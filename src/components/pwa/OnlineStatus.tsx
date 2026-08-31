'use client';

import { useEffect, useState } from 'react';

/**
 * A persistent offline banner. Staff work in basements and stilt parking, so
 * they need to know an action may not have reached the server before they walk
 * away from the car.
 */
export function OnlineStatus() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 bg-gold-500 px-3 py-1.5 text-center text-xs font-extrabold text-navy-900"
    >
      No connection — showing your last loaded data
    </div>
  );
}
