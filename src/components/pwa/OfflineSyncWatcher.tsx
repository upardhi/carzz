'use client';

import { useEffect } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { flushOfflineQueue } from '@/lib/util/offlineQueue';

/**
 * Listens for online/offline events across the application and automatically
 * flushes queued offline mutations when connectivity is restored.
 */
export function OfflineSyncWatcher() {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = async () => {
      // Small pause to allow network interface to stabilize
      setTimeout(async () => {
        const { success } = await flushOfflineQueue((item) => {
          toast.success(`${item.label} synced successfully.`);
        });

        if (success > 0) {
          toast.success(`You are back online! Synced ${success} pending action${success > 1 ? 's' : ''}.`);
        }
      }, 1000);
    };

    window.addEventListener('online', handleOnline);

    // Initial check in case user loaded while online with pending offline items
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [toast]);

  return null;
}
