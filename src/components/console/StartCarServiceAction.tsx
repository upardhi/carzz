'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/ToastProvider';

interface StartCarServiceActionProps {
  customerId: string;
  carId: string;
  carName: string;
  carPlate: string;
  currentAssignedStaffId?: string | null;
  staffList?: Array<{ id: string; name: string; phone?: string }>;
}

export function StartCarServiceAction({
  customerId,
  carId,
  carName,
  carPlate,
  currentAssignedStaffId,
  staffList = [],
}: StartCarServiceActionProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [assignedStaffId, setAssignedStaffId] = useState(currentAssignedStaffId || '');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/ops/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'startCarService',
          customerId,
          carId,
          assignedStaffId: assignedStaffId || null,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not start service');
      }
      toast.success(data.message || 'Service started! Washes scheduled.');
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
        variant="primary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Start Service Before Payment
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-lg font-bold text-ink">
                Start Service Before Payment
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-ink-mute hover:bg-surface-elevated hover:text-ink transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
              <p className="font-semibold text-amber-950 mb-1">
                ⚠️ Authorization Audit Record
              </p>
              This vehicle (<b>{carName} · {carPlate}</b>) is pending prepaid payment.
              Starting service now will immediately generate this month&apos;s wash schedule and assign visits to the wash boy.
              Your name and timestamp will be logged for the business owner&apos;s audit trail.
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
                  <option value="">— Unassigned (Assign later) —</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Visits generated for this vehicle will immediately be assigned to this cleaner.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1" htmlFor="override-note">
                  Reason / Approval Note (for Owner&apos;s Reference)
                </label>
                <textarea
                  id="override-note"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none resize-none"
                  placeholder="e.g. Customer promised cash payment on next wash; Trial 1st week approved; Regular trusted client."
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
                {pending ? 'Starting service…' : 'Confirm & Start Service'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
