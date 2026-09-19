'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Note } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/ToastProvider';
import { DocumentUploadPreview } from '@/components/ui/DocumentUploadPreview';
import { LocationPickerMap } from '@/components/ui/LocationPickerMap';
import type { Role, Area, Region } from '@/lib/data/types';
import { ROLE_LABEL } from '@/lib/util/labels';
import { IconIdCard, IconCreditCard } from '@/components/shell/icons';

const ASSIGNABLE_ROLES: { role: Role; label: string; blurb: string; icon: string }[] = [
  {
    role: 'MANAGER',
    label: 'Manager',
    blurb: 'Runs one area day to day',
    icon: '👔',
  },
  {
    role: 'AREA_ADMIN',
    label: 'Area Admin',
    blurb: 'Runs a region — managers and their staff',
    icon: '👥',
  },
  {
    role: 'EMPLOYEE',
    label: 'Wash Staff',
    blurb: "Car wash boy — today's cars and earnings",
    icon: '👤',
  },
  {
    role: 'SUPER_ADMIN',
    label: 'Super Admin',
    blurb: 'Owner — every area, every rupee',
    icon: '👑',
  },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || '??';
}

export function AddPersonClient({
  regions,
  areas,
  initialRole = 'SUPER_ADMIN',
  backHref = '/admin/users',
  backLabel = 'Back to People & Roles',
  title = 'Add New Team Member',
  description = 'Create account credentials, assign permissions, and attach identity verification documents.',
  allowedRoles,
}: {
  regions: Region[];
  areas: Area[];
  initialRole?: Role;
  backHref?: string;
  backLabel?: string;
  title?: string;
  description?: string;
  allowedRoles?: Role[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  // 1. Account & Role
  const [role, setRole] = useState<Role>(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [regionId, setRegionId] = useState(regions[0]?.id ?? '');
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '');

  // 2. KYC Documents
  const [kycDocType, setKycDocType] = useState<'aadhaar' | 'pan'>('aadhaar');
  const [aadharNumber, setAadharNumber] = useState('');
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [panNumber, setPanNumber] = useState('');
  const [panFile, setPanFile] = useState<File | null>(null);

  // 3. Address & Personal
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [dob, setDob] = useState('');

  // 4. Banking & Payout (for staff / managers)
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [upiId, setUpiId] = useState('');

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsArea = role === 'MANAGER' || role === 'EMPLOYEE';
  const needsRegion = role === 'AREA_ADMIN';

  // KYC Validation check: Aadhaar and PAN are individually optional, but at least ONE must be supplied
  const hasAadhaar = Boolean(aadharNumber.trim().length >= 4 || aadharFile);
  const hasPan = Boolean(panNumber.trim().length >= 4 || panFile);
  const hasKyc = hasAadhaar || hasPan;

  const valid =
    name.trim().length > 1 &&
    /.+@.+\..+/.test(email) &&
    phone.trim().length > 5 &&
    password.length >= 6 &&
    (!needsArea || areaId) &&
    (!needsRegion || regionId) &&
    hasKyc;

  async function uploadDoc(file: File, type: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const res = await fetch('/api/ops/staff/doc', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to upload ${type} document`);
    }

    const data = await res.json();
    return data.url;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;

    setPending(true);
    setError(null);

    try {
      let aadharCardUrl: string | undefined;
      let panCardUrl: string | undefined;

      if (aadharFile) {
        toast.info('Uploading Aadhaar card document...');
        aadharCardUrl = await uploadDoc(aadharFile, 'aadhar');
      }

      if (panFile) {
        toast.info('Uploading PAN card document...');
        panCardUrl = await uploadDoc(panFile, 'pan');
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          role,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password: password.trim(),
          regionId: needsRegion ? regionId : undefined,
          areaId: needsArea ? areaId : undefined,
          aadharNumber: aadharNumber.trim() || undefined,
          aadharCardUrl,
          panNumber: panNumber.trim().toUpperCase() || undefined,
          panCardUrl,
          address: address.trim() || undefined,
          emergencyContactName: emergencyContactName.trim() || undefined,
          emergencyPhone: emergencyPhone.trim() || undefined,
          dob: dob || undefined,
          bankName: bankName.trim() || undefined,
          accountNumber: bankAccountNumber.trim() || undefined,
          ifscCode: bankIfsc.trim().toUpperCase() || undefined,
          upiId: upiId.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user account');
      }

      toast.success(data.message || `${name} added successfully with KYC records!`);
      router.push(backHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add person.');
      toast.error(err instanceof Error ? err.message : 'Could not add person.');
    } finally {
      setPending(false);
    }
  }

  const selectedRegion = regions.find((r) => r.id === regionId);
  const selectedArea = areas.find((a) => a.id === areaId);
  const rolesToDisplay = allowedRoles
    ? ASSIGNABLE_ROLES.filter((r) => allowedRoles.includes(r.role))
    : ASSIGNABLE_ROLES;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16" suppressHydrationWarning>
      {/* Top Header & Breadcrumb */}
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors mb-2 cursor-pointer"
        >
          <span>←</span> {backLabel}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-navy-950">
          {title}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
          {description}
        </p>
      </div>

      {error && (
        <Note tone="danger">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </Note>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-3" suppressHydrationWarning>
        {/* Left 2 Columns: 4 Step Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6" suppressHydrationWarning>
          {/* Card 1: Account & Role Details */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm">
                1
              </div>
              <div>
                <h2 className="text-base font-bold text-navy-950">
                  Account & Role Details <span className="text-rose-500">*</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Select the account role and enter basic information.
                </p>
              </div>
            </div>

            {/* Role Select */}
            <div className="pt-1">
              <div className="block text-xs font-bold text-navy-950 mb-2">
                Select Account Role <span className="text-rose-500">*</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {rolesToDisplay.map((r) => {
                  const isSelected = role === r.role;
                  return (
                    <div
                      key={r.role}
                      onClick={() => setRole(r.role)}
                      className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{r.icon}</span>
                          <span className="font-semibold text-xs text-navy-950">
                            {r.label}
                          </span>
                        </div>
                        <div
                          className={`h-4 w-4 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <span className="text-[10px] font-bold">✓</span>}
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                        {r.blurb}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inputs: Full Name & Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-name">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    id="new-name"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs sm:text-sm text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-phone">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <input
                    id="new-phone"
                    inputMode="tel"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs sm:text-sm text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                    placeholder="e.g. 9822100001"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Inputs: Email & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-email">
                  Login Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    id="new-email"
                    type="email"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs sm:text-sm text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                    placeholder="e.g. rahul@carzz.app"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-pass">
                  Starting Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="new-pass"
                    type={showPassword ? 'text' : 'password'}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-xs sm:text-sm text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Scope Assignments */}
            {needsRegion && (
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-region">
                  Assigned Region <span className="text-rose-500">*</span>
                </label>
                <select
                  id="new-region"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-semibold text-navy-950 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                  value={regionId}
                  onChange={(e) => setRegionId(e.target.value)}
                >
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} Region
                    </option>
                  ))}
                </select>
              </div>
            )}

            {needsArea && (
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-area">
                  Assigned Area <span className="text-rose-500">*</span>
                </label>
                <select
                  id="new-area"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-semibold text-navy-950 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.city})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Card 2: KYC & Identity Verification */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 shadow-sm">
                  2
                </div>
                <div>
                  <h2 className="text-base font-bold text-navy-950">
                    KYC & Identity Verification (Aadhaar or PAN)
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Aadhaar and PAN are both optional individually, but at least ONE document is required for verification.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasKyc ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                    <span>✓</span> KYC Verified ({hasAadhaar && hasPan ? 'Aadhaar + PAN' : hasAadhaar ? 'Aadhaar' : 'PAN'})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                    <span>⚠️</span> Aadhaar or PAN required
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80">
                  <span>🔒</span> Encrypted
                </span>
              </div>
            </div>

            {/* Selection Option at Top: Select One Verification Type */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
              <div className="block text-xs font-bold text-navy-950">
                Select Identity Verification Type <span className="text-rose-500">* (At least 1 required)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setKycDocType('aadhaar')}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    kycDocType === 'aadhaar'
                      ? 'border-blue-600 bg-white text-navy-950 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white/60 text-slate-700 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                      <IconIdCard width={18} height={18} />
                    </span>
                    <div>
                      <div className="text-xs font-bold">Aadhaar Card Verification</div>
                      <div className="text-[10px] text-slate-500">12-Digit UID & Upload</div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="kycDocTypeSelection"
                    checked={kycDocType === 'aadhaar'}
                    onChange={() => setKycDocType('aadhaar')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setKycDocType('pan')}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    kycDocType === 'pan'
                      ? 'border-blue-600 bg-white text-navy-950 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white/60 text-slate-700 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <IconCreditCard width={18} height={18} />
                    </span>
                    <div>
                      <div className="text-xs font-bold">PAN Card Verification</div>
                      <div className="text-[10px] text-slate-500">10-Digit PAN & Upload</div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="kycDocTypeSelection"
                    checked={kycDocType === 'pan'}
                    onChange={() => setKycDocType('pan')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </button>
              </div>
            </div>

            {/* Selected Upload Card (Full Width) */}
            {kycDocType === 'aadhaar' ? (
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100 text-purple-600">
                      <IconIdCard width={14} height={14} />
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-navy-950">
                      Aadhaar Card Verification
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
                    Primary Identity Document
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="new-aadhar">
                    12-Digit Aadhaar Number
                  </label>
                  <input
                    id="new-aadhar"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                    placeholder="e.g. 5421 8901 2345"
                    maxLength={14}
                    value={aadharNumber}
                    onChange={(e) => setAadharNumber(e.target.value)}
                  />
                </div>

                <div>
                  <DocumentUploadPreview
                    id="aadhar-upload"
                    label="Aadhaar Card Copy (Front & Back or PDF)"
                    description="Upload clear photo or PDF copy of the Aadhaar card."
                    file={aadharFile}
                    onFileChange={setAadharFile}
                    maxSizeMB={10}
                  />
                </div>
              </div>
            ) : (
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-blue-600">
                      <IconCreditCard width={14} height={14} />
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-navy-950">
                      PAN Card Verification
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                    Primary Identity Document
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="new-pan">
                    10-Digit PAN Number
                  </label>
                  <input
                    id="new-pan"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs uppercase font-mono text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                    placeholder="e.g. ABCDE1234F"
                    maxLength={10}
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  />
                </div>

                <div>
                  <DocumentUploadPreview
                    id="pan-upload"
                    label="PAN Card Copy"
                    description="Upload clear image or PDF scan of the PAN card."
                    file={panFile}
                    onFileChange={setPanFile}
                    maxSizeMB={10}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Personal & Emergency Details */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700 shadow-sm">
                3
              </div>
              <div>
                <h2 className="text-base font-bold text-navy-950">
                  Personal & Emergency Details (Optional)
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Add residential address and emergency contact information.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-address">
                    Residential Address
                  </label>
                  <input
                    id="new-address"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs sm:text-sm text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                    placeholder="Flat/House No, Building, Street, City, Pincode"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <hr className="border-slate-100" />

                <div className="pt-1">
                  <h3 className="text-sm font-bold text-navy-950">Emergency Contact Details</h3>
                  <p className="text-[11px] text-slate-500 mb-3">Person to be contacted in case of emergency</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-emer-name">
                        Emergency Contact Name
                      </label>
                      <input
                        id="new-emer-name"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs sm:text-sm text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                        placeholder="e.g. Ramesh (Father / Spouse)"
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-emer-phone">
                        Emergency Mobile Phone
                      </label>
                      <input
                        id="new-emer-phone"
                        inputMode="tel"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs sm:text-sm text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                        placeholder="e.g. 9822100099"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-dob">
                    Date of Birth
                  </label>
                  <input
                    id="new-dob"
                    type="date"
                    className="w-full sm:w-1/2 rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs sm:text-sm text-navy-950 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <LocationPickerMap
                  address={address}
                  lat={lat}
                  lng={lng}
                  city={areas.find(a => a.id === areaId)?.city || 'Nagpur'}
                  hideAddressInput
                  onAddressChange={(newAddress) => setAddress(newAddress)}
                  onCoordinatesChange={(newLat, newLng) => {
                    setLat(newLat);
                    setLng(newLng);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card 4: Bank & Payout Details (Optional) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700 shadow-sm">
                4
              </div>
              <div>
                <h2 className="text-base font-bold text-navy-950">
                  Bank & Payout Details (Optional)
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Add bank details for salary or payout transfers.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-upi">
                  UPI ID (VPA)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    ⚡
                  </div>
                  <input
                    id="new-upi"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-3 text-xs sm:text-sm text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                    placeholder="e.g. 9822100001@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-bank">
                  Bank Name
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    🏦
                  </div>
                  <input
                    id="new-bank"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-3 text-xs sm:text-sm text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                    placeholder="e.g. State Bank of India"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-acc">
                  Account Number
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    💳
                  </div>
                  <input
                    id="new-acc"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-3 text-xs sm:text-sm font-mono text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                    placeholder="e.g. 30891234567"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1" htmlFor="new-ifsc">
                  IFSC Code
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    🔢
                  </div>
                  <input
                    id="new-ifsc"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-3 text-xs sm:text-sm font-mono uppercase text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                    placeholder="e.g. SBIN0001234"
                    maxLength={11}
                    value={bankIfsc}
                    onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {!valid && !pending ? (
            <p className="text-xs font-semibold text-amber-700">
              Before you can save: {[
                name.trim().length <= 1 && 'enter their full name',
                !/.+@.+\..+/.test(email) && 'enter a valid email',
                phone.trim().length <= 5 && 'enter a valid mobile number',
                password.length < 6 && 'set a password of at least 6 characters',
                needsArea && !areaId && 'choose their area',
                needsRegion && !regionId && 'choose their region',
                !hasKyc && 'add an Aadhaar or PAN number',
              ].filter(Boolean).join(', ')}.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={!valid || pending}
              className="flex-1 sm:flex-none sm:min-w-[200px] rounded-xl bg-blue-600 py-3 px-6 text-xs sm:text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {pending ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving Member & Documents…</span>
                </>
              ) : (
                <span>Save team member</span>
              )}
            </button>

            <Link
              href={backHref}
              className="rounded-xl border border-slate-200 bg-white py-3 px-6 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>

        {/* Right Column: Sticky Live Account Preview & Trust Cards */}
        <div className="space-y-4 lg:sticky lg:top-6">
          {/* Card 1: Live Account Preview */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-950">
                Live Account Preview
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                This is how the account will look after creation.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy-950 text-white font-bold text-sm shadow-xs">
                {name.trim() ? getInitials(name) : '??'}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-navy-950 truncate">
                  {name.trim() || 'Person Name'}
                </h4>
                <div className="mt-1">
                  <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200/60">
                    {ROLE_LABEL[role]}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-slate-100 pt-3 text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Email</span>
                <span className="font-mono text-navy-950 font-semibold truncate max-w-[170px]">
                  {email || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone</span>
                <span className="text-navy-950 font-semibold">{phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Scope</span>
                <span className="text-navy-950 font-semibold">
                  {role === 'SUPER_ADMIN'
                    ? 'All Areas'
                    : role === 'AREA_ADMIN'
                      ? `${selectedRegion?.name ?? '—'} Region`
                      : (selectedArea?.name ?? '—')}
                </span>
              </div>
            </div>

            {/* KYC & Setup Status checklist */}
            <div className="border-t border-slate-100 pt-3 space-y-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-navy-950 block">
                KYC & Setup Status
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                    <span className="text-slate-400"><IconIdCard width={14} height={14} /></span> Aadhaar or PAN
                  </span>
                  <span className={hasKyc ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                    {hasKyc ? `✓ ${hasAadhaar && hasPan ? 'Both' : hasAadhaar ? 'Aadhaar' : 'PAN'}` : 'Required (1 of 2)'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                    <span>📱</span> Valid Mobile
                  </span>
                  <span className={phone.trim().length > 5 ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium'}>
                    {phone.trim().length > 5 ? '✓ Valid' : 'Required'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                    <span>🔑</span> Password (≥ 6 chars)
                  </span>
                  <span className={password.length >= 6 ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium'}>
                    {password.length >= 6 ? '✓ Ready' : 'Required'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Security & Trust Card */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-blue-950">
                  Secure. Verified. Trusted.
                </h4>
                <p className="mt-0.5 text-[11px] text-blue-900/80 font-medium leading-relaxed">
                  All documents are stored securely and encrypted.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Need Help Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-navy-950">
                  Need help?
                </h4>
                <p className="mt-0.5 text-[11px] text-slate-500 font-medium leading-relaxed">
                  If you have any questions, check our help guide or contact support.
                </p>
              </div>
            </div>
            <Link
              href="/admin/settings"
              className="block w-full text-center rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-navy-950 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              View Help Guide
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
