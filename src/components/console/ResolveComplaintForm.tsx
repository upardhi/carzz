'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import { toast } from '@/components/ui/ToastProvider';
import { IconCheck } from '@/components/shell/icons';
import { safeOfflineFetch } from '@/lib/util/offlineQueue';

const QUICK = [
  'Free re-wash scheduled',
  'Rescheduled, wash returned to count',
  'Receipt re-sent',
  'Slot changed',
  'Spoken to the wash boy',
];

const STANDARD_SERVICES = [
  'Exterior wash',
  'Pressure wash',
  'Interior vacuum',
  'Polish / wax',
  'Tyre dressing',
  'Dashboard polish',
  'Glass cleaning',
];

export function ResolveComplaintForm({
  complaintId,
  canEscalate,
}: {
  complaintId: string;
  canEscalate: boolean;
}) {
  const router = useRouter();
  const [resolution, setResolution] = useState('');
  const [pending, setPending] = useState<'resolve' | 'escalate' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Free compensatory wash state
  const [grantFreeWash, setGrantFreeWash] = useState(false);
  const [freeWashDate, setFreeWashDate] = useState(() =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [selectedServices, setSelectedServices] = useState<string[]>([...STANDARD_SERVICES]);

  const allSelected = selectedServices.length === STANDARD_SERVICES.length;

  function toggleAllServices() {
    if (allSelected) {
      setSelectedServices(['Exterior wash']);
    } else {
      setSelectedServices([...STANDARD_SERVICES]);
    }
  }

  function toggleService(serviceName: string) {
    if (selectedServices.includes(serviceName)) {
      if (selectedServices.length > 1) {
        setSelectedServices(selectedServices.filter((s) => s !== serviceName));
      }
    } else {
      setSelectedServices([...selectedServices, serviceName]);
    }
  }

  async function send(action: 'resolve' | 'escalate') {
    setPending(action);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        complaintId,
        action,
        resolution: resolution.trim() || (grantFreeWash ? 'Free compensatory wash granted.' : 'Resolved.'),
      };

      if (action === 'resolve' && grantFreeWash) {
        payload.grantFreeWash = true;
        payload.freeWashDate = freeWashDate;
        payload.freeWashServices = selectedServices;
      }

      const result = await safeOfflineFetch<{ message?: string; error?: string }>('/api/ops/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        label: `${action === 'resolve' ? 'Resolve' : 'Escalate'} complaint #${complaintId.slice(-4)}`,
      });

      if (!result.ok) {
        const err = result.error ?? 'That did not work.';
        setError(err);
        toast.error(err);
        return;
      }

      if (result.queuedOffline) {
        toast.info('Action saved offline! Will sync automatically when connection is restored.', {
          title: 'Saved Offline (Auto-Sync)',
        });
      } else {
        toast.success(result.data?.message ?? (action === 'resolve' ? 'Complaint closed.' : 'Escalated to owner.'));
      }

      router.refresh();
    } catch {
      setError('Something unexpected happened.');
      toast.error('Something unexpected happened.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => {
              setResolution(text);
              if (text.toLowerCase().includes('free')) {
                setGrantFreeWash(true);
              }
            }}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900 shadow-2xs"
          >
            {text}
          </button>
        ))}
      </div>

      <label className="sr-only" htmlFor={`res-${complaintId}`}>
        What did you do?
      </label>
      <textarea
        id={`res-${complaintId}`}
        className="field"
        rows={2}
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        placeholder="What did you do about it? The customer sees this."
      />

      {/* FREE WASH TOGGLE & SUB-SERVICES CONFIG */}
      <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-blue-950">
            <input
              type="checkbox"
              checked={grantFreeWash}
              onChange={(e) => setGrantFreeWash(e.target.checked)}
              className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
            />
            <span>🎁 Grant 1 Free Compensatory Wash</span>
          </label>

          {grantFreeWash && (
            <button
              type="button"
              onClick={toggleAllServices}
              className="text-[11px] font-bold text-blue-700 hover:underline"
            >
              {allSelected ? 'Deselect All' : 'Select All Services'}
            </button>
          )}
        </div>

        {grantFreeWash && (
          <div className="pt-2 border-t border-blue-100 space-y-2 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Scheduled Date for Free Wash
              </label>
              <input
                type="date"
                value={freeWashDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setFreeWashDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10.5px] text-slate-500 mt-0.5">
                Customer can reschedule this free wash in their app if unavailable on this day.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Included Sub-Services for this Free Wash ({selectedServices.length})
              </label>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-blue-100 bg-white p-2">
                {STANDARD_SERVICES.map((s) => {
                  const on = selectedServices.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleService(s)}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-medium transition-colors ${
                        on ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                          on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                        }`}
                      >
                        {on ? <IconCheck width={9} height={9} strokeWidth={3} /> : null}
                      </span>
                      <span className="truncate">{s}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={pending !== null || (!grantFreeWash && resolution.trim().length < 3)}
          onClick={() => send('resolve')}
        >
          {pending === 'resolve' ? 'Closing…' : 'Reply & close'}
        </Button>
        {canEscalate ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending !== null}
            onClick={() => send('escalate')}
          >
            {pending === 'escalate' ? 'Sending…' : 'Escalate to owner'}
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="mt-2">
          <Note tone="danger">{error}</Note>
        </div>
      ) : null}
    </div>
  );
}
