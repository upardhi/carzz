'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';

interface QuickAssignStaffProps {
  customerId: string;
  carId: string;
  currentStaffId: string | null;
  staffList: Array<{ id: string; name: string; phone?: string }>;
}

export function QuickAssignStaff({
  customerId,
  carId,
  currentStaffId,
  staffList,
}: QuickAssignStaffProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState(currentStaffId || '');
  const [saving, setSaving] = useState(false);
  // Mirrors currentStaffId but updates the instant a save succeeds, rather
  // than waiting on router.refresh() to re-render this component with a new
  // prop — which happens on its own schedule and left this showing stale
  // "Unassigned" right after a successful assignment.
  const [displayStaffId, setDisplayStaffId] = useState(currentStaffId);

  const assignedStaff = staffList.find((s) => s.id === displayStaffId);

  async function handleAssign(newStaffId: string) {
    setSelectedStaffId(newStaffId);
    setSaving(true);
    try {
      const res = await fetch('/api/ops/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateCar',
          customerId,
          carId,
          assignedStaffId: newStaffId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to assign wash boy');
      }

      const assigned = staffList.find((s) => s.id === newStaffId);
      toast.success(
        newStaffId
          ? `Assigned to ${assigned?.name || 'Wash boy'}. Schedule updated.`
          : 'Wash boy unassigned.',
      );
      setDisplayStaffId(newStaffId || null);
      setIsEditing(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update assignment');
      setSelectedStaffId(currentStaffId || '');
    } finally {
      setSaving(false);
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
        <select
          value={selectedStaffId}
          disabled={saving}
          onChange={(e) => handleAssign(e.target.value)}
          className="rounded-md border border-blue-400 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-blue-600 focus:outline-none disabled:opacity-50"
          autoFocus
        >
          <option value="">— Unassigned —</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.phone ? `(${s.phone})` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setSelectedStaffId(currentStaffId || '');
            setIsEditing(false);
          }}
          className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {assignedStaff ? (
        <span className="font-semibold text-slate-900 text-xs">
          {assignedStaff.name}
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10.5px] font-bold text-rose-700">
          Unassigned
        </span>
      )}

      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors shadow-2xs cursor-pointer"
      >
        <span>⚡</span>
        <span>{assignedStaff ? 'Change' : 'Assign Wash Boy'}</span>
      </button>
    </div>
  );
}
