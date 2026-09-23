'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { getSafeDocumentUrl } from '@/lib/util/doc-url';
import { formatDateFull } from '@/lib/util/format';
import { ROLE_LABEL, ROLE_BLURB } from '@/lib/util/labels';
import type { User, Staff, Area, Region } from '@/lib/data/types';

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || '??';
}

export function UserDetailClient({
  user,
  staff,
  areas,
  regions,
}: {
  user: User;
  staff: Staff | null;
  areas: Area[];
  regions: Region[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [active, setActive] = useState(user.active);
  const [updating, setUpdating] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState('');

  const area = user.areaId ? areas.find((a) => a.id === user.areaId) : null;
  const region = user.regionId ? regions.find((r) => r.id === user.regionId) : null;

  const aadharNumber = user.aadharNumber || staff?.aadharNumber;
  const aadharCardUrl = user.aadharCardUrl || staff?.aadharCardUrl;
  const panNumber = user.panNumber || staff?.panNumber;
  const panCardUrl = user.panCardUrl || staff?.panCardUrl;

  const address = user.address || staff?.address;
  const emergencyPhone = user.emergencyPhone || staff?.emergencyPhone;
  const emergencyContactName = user.emergencyContactName || staff?.emergencyContactName;
  const dob = user.dob || staff?.dob;

  const bankName = user.bankName || staff?.bankName;
  const accountNumber = user.accountNumber || staff?.bankAccountNumber;
  const ifscCode = user.ifscCode || staff?.bankIfsc;
  const upiId = user.upiId || staff?.upiId;

  const hasAadhar = Boolean(aadharNumber || aadharCardUrl);
  const hasPan = Boolean(panNumber || panCardUrl);
  const hasBank = Boolean(bankName || accountNumber || upiId);

  const scopeLabel =
    user.role === 'SUPER_ADMIN'
      ? 'All Areas (Global Access)'
      : user.role === 'AREA_ADMIN'
        ? region
          ? `${region.name} Region`
          : 'Region'
        : area
          ? `${area.name} (${area.city})`
          : 'No area assigned';

  async function handleToggleStatus() {
    const nextState = !active;
    const ok = await confirm({
      title: nextState ? 'Reactivate Account?' : 'Deactivate Team Member?',
      message: nextState
        ? `Are you sure you want to reactivate ${user.name}'s account? They will be able to sign in again immediately.`
        : `Are you sure you want to deactivate ${user.name}? Their login will be disabled and they will no longer have access to the system.`,
      confirmText: nextState ? 'Reactivate' : 'Deactivate Account',
      tone: nextState ? 'primary' : 'danger',
    });

    if (!ok) return;

    setUpdating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setActive',
          userId: user.id,
          active: nextState,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to update account status.');
      }

      setActive(nextState);
      toast.success(data.message || (nextState ? 'Account reactivated.' : 'Account deactivated.'));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link
              href="/admin/users"
              className="hover:text-blue-600 transition-colors flex items-center gap-1"
            >
              <span>←</span>
              <span>People & Roles</span>
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-bold">{user.name}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {user.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {ROLE_LABEL[user.role]} • Added on {formatDateFull(user.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={updating}
            className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
              active
                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {updating ? 'Updating...' : active ? 'Deactivate Account' : 'Reactivate Account'}
          </button>

          <Link
            href={`/admin/users/${user.id}/edit`}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition-all"
          >
            <span>✏️</span>
            <span>Edit Member</span>
          </Link>
        </div>
      </div>

      {/* Main Grid: Left Details & Right Sticky Sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Information Cards */}
        <div className="space-y-6 lg:col-span-2">
          {/* Card 1: Account & Role Overview */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-base">
                  👤
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    1. Account & Role Overview
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Core identity, permissions, and system access
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  active
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {active ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Assigned Role
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-sm">{ROLE_LABEL[user.role]}</span>
                  <span className="rounded-md bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px] font-bold">
                    {user.role}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{ROLE_BLURB[user.role]}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Operating Scope
                </span>
                <p className="font-bold text-slate-800 text-sm">{scopeLabel}</p>
                <p className="text-[11px] text-slate-500">
                  {user.role === 'SUPER_ADMIN'
                    ? 'Full read & write access across all regions & areas'
                    : 'Restricted strictly to assigned jurisdiction'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Login Email
                </span>
                <p className="font-mono font-bold text-slate-800 text-xs truncate">{user.email}</p>
                <p className="text-[11px] text-slate-500">Used for web and mobile login</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Mobile Number
                </span>
                <p className="font-mono font-bold text-slate-800 text-xs">{user.phone}</p>
                <p className="text-[11px] text-slate-500">Direct contact & SMS alerts</p>
              </div>
            </div>
          </div>

          {/* Card 2: KYC & Identity Verification */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-base">
                  🪪
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    2. KYC & Identity Verification
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Government identity documents & verified proof
                  </p>
                </div>
              </div>
              <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                🔒 Private Encrypted
              </span>
            </div>

            {!hasAadhar && !hasPan ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                <p className="text-xs font-bold text-slate-700">No KYC documents attached</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Neither Aadhaar nor PAN card has been provided for this member yet.
                </p>
              </div>
            ) : (
              <div className={`grid grid-cols-1 ${hasAadhar && hasPan ? 'sm:grid-cols-2' : ''} gap-4`}>
                {/* Aadhaar Section */}
                {hasAadhar && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Aadhaar Card (UID)</span>
                      <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        ✓ Attached
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Aadhaar Number
                      </span>
                      <p className="font-mono text-xs font-bold text-slate-800">
                        {aadharNumber ? aadharNumber : '—'}
                      </p>
                    </div>

                    {aadharCardUrl ? (
                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                          Document Copy
                        </span>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {aadharCardUrl.toLowerCase().endsWith('.pdf') ? (
                              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-rose-50 text-lg border border-rose-200">
                                📕
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setLightboxUrl(getSafeDocumentUrl(aadharCardUrl));
                                  setLightboxTitle('Aadhaar Card Document');
                                }}
                                className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 cursor-pointer"
                                title="Click to view full preview"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={getSafeDocumentUrl(aadharCardUrl)}
                                  alt="Aadhaar Document"
                                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="text-white text-[10px]">🔍</span>
                                </div>
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">Aadhaar Card Copy</p>
                              <p className="text-[10px] text-slate-500">
                                {aadharCardUrl.toLowerCase().endsWith('.pdf') ? 'PDF Document' : 'Image (PNG/JPG)'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {!aadharCardUrl.toLowerCase().endsWith('.pdf') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setLightboxUrl(getSafeDocumentUrl(aadharCardUrl));
                                  setLightboxTitle('Aadhaar Card Document');
                                }}
                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                Preview
                              </button>
                            )}
                            <a
                              href={getSafeDocumentUrl(aadharCardUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              View ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No document file attached.</p>
                    )}
                  </div>
                )}

                {/* PAN Section */}
                {hasPan && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">PAN Card</span>
                      <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        ✓ Attached
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        PAN Number
                      </span>
                      <p className="font-mono text-xs font-bold text-slate-800 uppercase">
                        {panNumber ? panNumber : '—'}
                      </p>
                    </div>

                    {panCardUrl ? (
                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                          Document Copy
                        </span>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {panCardUrl.toLowerCase().endsWith('.pdf') ? (
                              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-rose-50 text-lg border border-rose-200">
                                📕
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setLightboxUrl(getSafeDocumentUrl(panCardUrl));
                                  setLightboxTitle('PAN Card Document');
                                }}
                                className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 cursor-pointer"
                                title="Click to view full preview"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={getSafeDocumentUrl(panCardUrl)}
                                  alt="PAN Document"
                                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="text-white text-[10px]">🔍</span>
                                </div>
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">PAN Card Copy</p>
                              <p className="text-[10px] text-slate-500">
                                {panCardUrl.toLowerCase().endsWith('.pdf') ? 'PDF Document' : 'Image (PNG/JPG)'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {!panCardUrl.toLowerCase().endsWith('.pdf') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setLightboxUrl(getSafeDocumentUrl(panCardUrl));
                                  setLightboxTitle('PAN Card Document');
                                }}
                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                Preview
                              </button>
                            )}
                            <a
                              href={getSafeDocumentUrl(panCardUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              View ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No document file attached.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 3: Personal & Emergency Contact */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-base">
                🏠
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  3. Personal & Emergency Contact
                </h3>
                <p className="text-[11px] text-slate-500">
                  Residential address, date of birth, and emergency contacts
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Residential Address
                </span>
                <p className="font-semibold text-slate-800">{address || '—'}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Emergency Contact Name
                </span>
                <p className="font-semibold text-slate-800">{emergencyContactName || '—'}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Emergency Mobile Phone
                </span>
                <p className="font-mono font-semibold text-slate-800">{emergencyPhone || '—'}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Date of Birth
                </span>
                <p className="font-semibold text-slate-800">{dob || '—'}</p>
              </div>
            </div>
          </div>

          {/* Card 4: Banking & Payout Details */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-base">
                  🏦
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    4. Banking & Payout Details
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Direct bank account and UPI details for staff salary / payouts
                  </p>
                </div>
              </div>
              {hasBank ? (
                <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  ✓ Configured
                </span>
              ) : (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  Not configured
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  UPI ID (VPA)
                </span>
                <p className="font-mono font-bold text-slate-800">{upiId || '—'}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Bank Name
                </span>
                <p className="font-semibold text-slate-800">{bankName || '—'}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Account Number
                </span>
                <p className="font-mono font-bold text-slate-800">{accountNumber || '—'}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  IFSC Code
                </span>
                <p className="font-mono font-bold text-slate-800 uppercase">{ifscCode || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Sticky Summary & Fast Actions */}
        <div className="space-y-6">
          {/* Live Profile Card */}
          <div className="sticky top-6 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Member Profile
              </h4>

              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0F2347] text-lg font-bold text-white shadow-sm ring-2 ring-blue-500/20">
                  {getInitials(user.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {user.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px] font-bold">
                      {ROLE_LABEL[user.role]}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      title={active ? 'Active' : 'Disabled'}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-3 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Scope:</span>
                  <span className="font-semibold text-slate-800 text-right max-w-[180px] truncate">
                    {scopeLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Email:</span>
                  <span className="font-mono font-medium text-slate-800 truncate max-w-[180px]">
                    {user.email}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Phone:</span>
                  <span className="font-mono font-medium text-slate-800">{user.phone}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Language:</span>
                  <span className="font-bold text-slate-800 uppercase">{user.language}</span>
                </div>
              </div>

              {/* KYC Status Checklist */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                  Verification Checklist
                </span>
                <div className="space-y-1.5 text-xs">
                  {hasAadhar && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Aadhaar Card:</span>
                      <span
                        className={`font-bold ${
                          aadharCardUrl ? 'text-emerald-600' : 'text-blue-600'
                        }`}
                      >
                        {aadharCardUrl ? '✓ Attached' : 'UID Only'}
                      </span>
                    </div>
                  )}
                  {hasPan && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">PAN Card:</span>
                      <span
                        className={`font-bold ${
                          panCardUrl ? 'text-emerald-600' : 'text-blue-600'
                        }`}
                      >
                        {panCardUrl ? '✓ Attached' : 'PAN Only'}
                      </span>
                    </div>
                  )}
                  {!hasAadhar && !hasPan && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Identity Proof:</span>
                      <span className="font-bold text-rose-500">Missing</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Bank Details:</span>
                    <span
                      className={`font-bold ${hasBank ? 'text-emerald-600' : 'text-slate-400'}`}
                    >
                      {hasBank ? '✓ Configured' : 'Missing'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href={`/admin/users/${user.id}/edit`}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs text-center"
                >
                  <span>✏️ Edit Member Details</span>
                </Link>
              </div>
            </div>

            {/* Security Badge Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <span>🛡️</span>
                <span>Security & Access Control</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Role-based access permissions are strictly enforced on every API route and database query.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="text-sm font-bold text-slate-900">{lightboxTitle}</h4>
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-xl bg-slate-900/10 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxUrl}
                alt={lightboxTitle}
                className="max-h-[65vh] w-auto rounded-lg object-contain shadow-md"
              />
            </div>
            <div className="flex justify-between items-center pt-1">
              <a
                href={lightboxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50"
              >
                Open Original in New Tab ↗
              </a>
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="rounded-xl bg-[#0F2347] px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
