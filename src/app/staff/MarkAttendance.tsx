'use client';

import { useEffect } from 'react';

/**
 * Fires once per app open to record attendance. Deliberately silent: the wash
 * boy has already done the only thing required of him, which is to show up and
 * open the app.
 */
export function MarkAttendance() {
  useEffect(() => {
    const key = `carzz.attendance.${new Date().toISOString().slice(0, 10)}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Storage blocked — the endpoint is idempotent, so posting again is safe.
    }
    void fetch('/api/staff/attendance', { method: 'POST' }).catch(() => {});
  }, []);

  return null;
}
