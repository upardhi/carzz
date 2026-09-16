'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/ToastProvider';

interface WashTodayActionProps {
  customerId: string;
  carId: string;
  carName: string;
  carPlate: string;
  currentAssignedStaffId?: string | null;
  staffList?: Array<{ id: string; name: string; phone?: string }>;
}

export function WashTodayAction({
  customerId,
  carId,
  carName,
  carPlate,
  currentAssignedStaffId,
  staffList = [],
}: WashTodayActionProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [assignedStaffId, setAssignedStaffId] = useState(currentAssignedStaffId || '');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!assignedStaffId) {
      setError('You must select a wash boy to assign this ad-hoc wash to.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/ops/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adhocWash',
          customerId,
          carId,
          assignedStaffId,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not schedule ad-hoc wash');
      }
      toast.success(data.message || 'Wash scheduled for today!');
      setOpen(false);
      setNote('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Wash Today
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-lg font-bold text-ink">
                Schedule Ad-hoc Wash for Today
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-ink-mute hover:bg-surface-elevated hover:text-ink transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 leading-relaxed">
              <p className="font-semibold text-sky-950 mb-1">
                📅 Wash Today (Ad-hoc)
              </p>
              This vehicle (<b>{carName} · {carPlate}</b>) will immediately have a pending wash generated for today&apos;s date, and it will count toward their monthly limit.
            </div>

            {error && <Note tone="danger">{error}</Note>}

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1" htmlFor="assign-staff-modal">
                  Assign Wash Boy / Cleaner {staffList.length > 0 ? '' : '(No staff in area)'}
                </label>
                <select
                  id="assign-staff-modal"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  value={assignedStaffId}
                  onChange={(e) => setAssignedStaffId(e.target.value)}
                >
                  <option value="">— Select Wash Boy —</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  You must assign a cleaner so they receive the visit on their app immediately.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1" htmlFor="override-note">
                  Note (Optional)
                </label>
                <textarea
                  id="override-note"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none resize-none"
                  placeholder="e.g. Customer requested a wash today instead of tomorrow."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={pending}
              >
                {pending ? 'Scheduling…' : 'Schedule Wash'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
