'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Note } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/ToastProvider';
import { DocumentUploadPreview } from '@/components/ui/DocumentUploadPreview';
import { LocationPickerMap } from '@/components/ui/LocationPickerMap';
import type { Role, Area, Region, User, Staff } from '@/lib/data/types';
import { ROLE_LABEL } from '@/lib/util/labels';

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

export function EditPersonClient({
  user,
  staff,
  regions,
  areas,
}: {
  user: User;
  staff: Staff | null;
  regions: Region[];
  areas: Area[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  // 1. Account & Role
  const [role, setRole] = useState<Role>(user.role);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [regionId, setRegionId] = useState(user.regionId ?? regions[0]?.id ?? '');
  const [areaId, setAreaId] = useState(user.areaId ?? areas[0]?.id ?? '');

  // 2. KYC Documents
  const hasExistingPan = Boolean(user.panNumber || user.panCardUrl || staff?.panNumber || staff?.panCardUrl);
  const hasExistingAadhaar = Boolean(user.aadharNumber || user.aadharCardUrl || staff?.aadharNumber || staff?.aadharCardUrl);
  const [kycDocType, setKycDocType] = useState<'aadhaar' | 'pan'>(
    hasExistingPan && !hasExistingAadhaar ? 'pan' : 'aadhaar'
  );
  const [aadharNumber, setAadharNumber] = useState(user.aadharNumber || staff?.aadharNumber || '');
  const [aadharCardUrl, setAadharCardUrl] = useState<string | null>(user.aadharCardUrl || staff?.aadharCardUrl || null);
  const [aadharFile, setAadharFile] = useState<File | null>(null);

  const [panNumber, setPanNumber] = useState(user.panNumber || staff?.panNumber || '');
  const [panCardUrl, setPanCardUrl] = useState<string | null>(user.panCardUrl || staff?.panCardUrl || null);
  const [panFile, setPanFile] = useState<File | null>(null);

  // 3. Address & Personal
  const [address, setAddress] = useState(user.address || staff?.address || '');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [emergencyContactName, setEmergencyContactName] = useState(user.emergencyContactName || staff?.emergencyContactName || '');
  const [emergencyPhone, setEmergencyPhone] = useState(user.emergencyPhone || staff?.emergencyPhone || '');
  const [dob, setDob] = useState(user.dob || staff?.dob || '');

  // 4. Banking & Payout
  const [bankName, setBankName] = useState(user.bankName || staff?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(user.accountNumber || staff?.bankAccountNumber || '');
  const [ifscCode, setIfscCode] = useState(user.ifscCode || staff?.bankIfsc || '');
  const [upiId, setUpiId] = useState(user.upiId || staff?.upiId || '');

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsArea = role === 'MANAGER' || role === 'EMPLOYEE';
  const needsRegion = role === 'AREA_ADMIN';

  const valid =
    name.trim().length > 1 &&
    /.+@.+\..+/.test(email) &&
    phone.trim().length > 5 &&
    (password.length === 0 || password.length >= 6) &&
    (!needsArea || areaId) &&
    (!needsRegion || regionId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;

    setPending(true);
    setError(null);

    try {
      const formData = new FormData();
      
      const payload = {
        action: 'update',
        userId: user.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        regionId: role === 'AREA_ADMIN' ? regionId : null,
        areaId: role === 'MANAGER' || role === 'EMPLOYEE' ? areaId : null,
        password: password ? password : undefined,
        aadharNumber: aadharNumber.trim() || undefined,
        aadharCardUrl: aadharFile ? undefined : aadharCardUrl,
        panNumber: panNumber.trim().toUpperCase() || undefined,
        panCardUrl: panFile ? undefined : panCardUrl,
        address: address.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyPhone: emergencyPhone.trim() || undefined,
        dob: dob || undefined,
        bankName: bankName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        ifscCode: ifscCode.trim().toUpperCase() || undefined,
        upiId: upiId.trim() || undefined,
      };

      formData.append('data', JSON.stringify(payload));
      if (aadharFile) formData.append('aadharFile', aadharFile);
      if (panFile) formData.append('panFile', panFile);

      toast.info('Updating account and uploading documents...');

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        body: formData,
      });

      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? 'Could not update user.');
      }

      toast.success(body.message ?? 'Member details updated successfully!');
      router.push(`/admin/users/${user.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  }

  const selectedRegion = regions.find((r) => r.id === regionId);
  const selectedArea = areas.find((a) => a.id === areaId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16" suppressHydrationWarning>
      {/* Top Header & Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
          <Link
            href="/admin/users"
            className="text-blue-600 hover:text-blue-800 font-bold transition-colors"
          >
            People & Roles
          </Link>
          <span>/</span>
          <Link
            href={`/admin/users/${user.id}`}
            className="text-blue-600 hover:text-blue-800 font-bold transition-colors"
          >
            {user.name}
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-bold">Edit Details</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Edit Team Member
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Update account access, KYC identity documents, personal details, and banking information.
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" suppressHydrationWarning>
        {/* Left 2 Columns: 4 Step Form */}
        <form onSubmit={handleSubmit} className="space-y-6 lg:col-span-2" suppressHydrationWarning>
          {/* Card 1: Account & Role */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-base">
                👤
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  1. Account & Role Details <span className="text-rose-500">*</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Set permissions, access scope, and login credentials
                </p>
              </div>
            </div>

            {/* Role Selection Cards */}
            <div className="space-y-2">
              <div className="block text-xs font-bold text-slate-900">
                System Role <span className="text-rose-500">*</span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {ASSIGNABLE_ROLES.map((r) => {
                  const isSelected = role === r.role;
                  return (
                    <div
                      key={r.role}
                      onClick={() => setRole(r.role)}
                      className={`relative flex flex-col justify-between rounded-xl border p-3.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xl">{r.icon}</span>
                          <span
                            className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                        </div>
                        <h4 className="mt-2 text-xs font-bold text-slate-900">
                          {r.label}
                        </h4>
                        <p className="mt-0.5 text-[11px] text-slate-500 leading-snug line-clamp-2">
                          {r.blurb}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Basic Info Inputs */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1" htmlFor="edit-name">
                  👤 Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patil"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1" htmlFor="edit-phone">
                  📞 Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  id="edit-phone"
                  type="tel"
                  required
                  placeholder="10-digit mobile (e.g. 9876543210)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1" htmlFor="edit-email">
                  ✉️ Login Email <span className="text-rose-500">*</span>
                </label>
                <input
                  id="edit-email"
                  type="email"
                  required
                  placeholder="user@carzz.in"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1" htmlFor="edit-password">
                  🔒 New Password (Optional)
                </label>
                <div className="relative">
                  <input
                    id="edit-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Leave blank to keep current"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </div>

            {/* Scope Selection */}
            {role === 'AREA_ADMIN' && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-2">
                <label className="block text-xs font-bold text-slate-900" htmlFor="edit-region">
                  🏙️ Assigned Region <span className="text-rose-500">*</span>
                </label>
                <select
                  id="edit-region"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none font-medium"
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

            {(role === 'MANAGER' || role === 'EMPLOYEE') && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-2">
                <label className="block text-xs font-bold text-slate-900" htmlFor="edit-area">
                  📍 Assigned Area / Territory <span className="text-rose-500">*</span>
                </label>
                <select
                  id="edit-area"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none font-medium"
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
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
                    Attach government proof for compliance & identity verification
                  </p>
                </div>
              </div>
              <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                🔒 Private Cloud Encrypted
              </span>
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
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-sm">
                      🪪
                    </span>
                    <div>
                      <div className="text-xs font-bold">Aadhaar Card Verification</div>
                      <div className="text-[10px] text-slate-500">12-Digit UID & Upload</div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="editKycDocTypeSelection"
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
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-sm">
                      💳
                    </span>
                    <div>
                      <div className="text-xs font-bold">PAN Card Verification</div>
                      <div className="text-[10px] text-slate-500">10-Digit PAN & Upload</div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="editKycDocTypeSelection"
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
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100 text-xs">
                      🪪
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
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="edit-aadhar-num">
                    12-Digit Aadhaar Number
                  </label>
                  <input
                    id="edit-aadhar-num"
                    type="text"
                    placeholder="12-digit number (e.g. 5421 8901 2345)"
                    maxLength={14}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none shadow-xs"
                    value={aadharNumber}
                    onChange={(e) => setAadharNumber(e.target.value)}
                  />
                </div>

                <DocumentUploadPreview
                  id="edit-aadhar-upload"
                  label="Aadhaar Document Copy"
                  description="Upload front/back scanned copy or PDF"
                  file={aadharFile}
                  existingUrl={aadharCardUrl}
                  onFileChange={(f) => {
                    setAadharFile(f);
                    if (!f && !aadharCardUrl) setAadharCardUrl(null);
                  }}
                  maxSizeMB={10}
                />
              </div>
            ) : (
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-xs">
                      💳
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
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1" htmlFor="edit-pan-num">
                    10-Digit PAN Number
                  </label>
                  <input
                    id="edit-pan-num"
                    type="text"
                    placeholder="e.g. ABCDE1234F"
                    maxLength={10}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono uppercase text-navy-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none shadow-xs"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  />
                </div>

                <DocumentUploadPreview
                  id="edit-pan-upload"
                  label="PAN Document Copy"
                  description="Upload clear copy of PAN card"
                  file={panFile}
                  existingUrl={panCardUrl}
                  onFileChange={(f) => {
                    setPanFile(f);
                    if (!f && !panCardUrl) setPanCardUrl(null);
                  }}
                  maxSizeMB={10}
                />
              </div>
            )}
          </div>

          {/* Card 3: Personal & Emergency Contact */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-base">
                🏠
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  3. Personal & Emergency Details
                </h3>
                <p className="text-[11px] text-slate-500">
                  Residential address and verified emergency contacts
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1" htmlFor="edit-address">
                    🏠 Residential Address
                  </label>
                  <input
                    id="edit-address"
                    type="text"
                    placeholder="Flat/House No, Building, Street, City, Pincode"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <hr className="border-slate-100" />

                <div className="pt-1">
                  <h3 className="text-sm font-bold text-slate-900">Emergency Contact Details</h3>
                  <p className="text-[11px] text-slate-500 mb-3">Person to be contacted in case of emergency</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1" htmlFor="edit-emg-name">
                        👤 Emergency Contact Name
                      </label>
                      <input
                        id="edit-emg-name"
                        type="text"
                        placeholder="Relative / Parent / Spouse"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1" htmlFor="edit-emg-phone">
                        📞 Emergency Mobile Phone
                      </label>
                      <input
                        id="edit-emg-phone"
                        type="tel"
                        placeholder="10-digit emergency phone"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-900 mb-1" htmlFor="edit-dob">
                    📅 Date of Birth
                  </label>
                  <input
                    id="edit-dob"
                    type="date"
                    className="w-full sm:w-1/2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
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

          {/* Card 4: Banking & Payout Details */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-base">
                🏦
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  4. Bank & Payout Details (Optional)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Direct bank account and UPI details for staff salary / pocket money payouts
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1" htmlFor="edit-upi">
                  ⚡ UPI ID (VPA)
                </label>
                <input
                  id="edit-upi"
                  type="text"
                  placeholder="e.g. mobile@upi or name@okhdfcbank"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1" htmlFor="edit-bank-name">
                  🏦 Bank Name
                </label>
                <input
                  id="edit-bank-name"
                  type="text"
                  placeholder="e.g. State Bank of India, HDFC Bank"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1" htmlFor="edit-acc-num">
                  💳 Account Number
                </label>
                <input
                  id="edit-acc-num"
                  type="text"
                  placeholder="e.g. 100293848123"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1" htmlFor="edit-ifsc">
                  🔢 IFSC Code
                </label>
                <input
                  id="edit-ifsc"
                  type="text"
                  placeholder="e.g. SBIN0001234"
                  maxLength={11}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono uppercase text-slate-800 focus:border-blue-600 focus:outline-none"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href={`/admin/users/${user.id}`}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!valid || pending}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
            >
              {pending && (
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              <span>{pending ? 'Saving changes...' : 'Save Member Changes'}</span>
            </button>
          </div>
        </form>

        {/* Right 1 Column: Sticky Live Account Preview */}
        <div>
          <div className="sticky top-6 space-y-5">
            {/* Live Profile Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Live Account Preview
              </h4>

              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0F2347] text-lg font-bold text-white shadow-sm ring-2 ring-blue-500/20">
                  {name.trim() ? getInitials(name) : '??'}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {name.trim() || 'Member Name'}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px] font-bold">
                      {ROLE_LABEL[role]}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate">
                      {role === 'SUPER_ADMIN'
                        ? 'Global'
                        : role === 'AREA_ADMIN'
                          ? selectedRegion?.name ?? 'Region'
                          : selectedArea?.name ?? 'Area'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-3 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Login Email:</span>
                  <span className="font-mono font-medium text-slate-800 truncate max-w-[180px]">
                    {email.trim() || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Mobile Phone:</span>
                  <span className="font-mono font-medium text-slate-800">{phone.trim() || '—'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Password Status:</span>
                  <span className="font-semibold text-slate-800">
                    {password ? 'Updating to new' : 'Unchanged'}
                  </span>
                </div>
              </div>

              {/* Real-time Checklist */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                  KYC & Setup Status
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Aadhaar Card:</span>
                    <span
                      className={`font-bold ${
                        aadharFile || aadharCardUrl ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {aadharFile ? '✓ New Attached' : aadharCardUrl ? '✓ Attached' : 'Missing'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">PAN Card:</span>
                    <span
                      className={`font-bold ${
                        panFile || panCardUrl ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {panFile ? '✓ New Attached' : panCardUrl ? '✓ Attached' : 'Missing'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Bank Details:</span>
                    <span
                      className={`font-bold ${
                        bankName || accountNumber || upiId ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {bankName || accountNumber || upiId ? '✓ Configured' : 'Missing'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Security & Access Box */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <span>🛡️</span>
                <span>Security & Trust</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Sensitive KYC documents and banking details are encrypted and stored in secure cloud storage.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
