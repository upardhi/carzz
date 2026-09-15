'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import type { Role } from '@/lib/data/types';
import { ROLE_BLURB, ROLE_LABEL } from '@/lib/util/labels';

const ASSIGNABLE: Role[] = ['SUPER_ADMIN', 'AREA_ADMIN', 'MANAGER', 'EMPLOYEE'];

export function AddUserForm({
  regions,
  areas,
}: {
  regions: { id: string; name: string }[];
  areas: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>('MANAGER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [regionId, setRegionId] = useState(regions[0]?.id ?? '');
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '');

  // KYC & Additional Details
  const [kycDocType, setKycDocType] = useState<'aadhaar' | 'pan'>('aadhaar');
  const [aadharNumber, setAadharNumber] = useState('');
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [panNumber, setPanNumber] = useState('');
  const [panFile, setPanFile] = useState<File | null>(null);
  const [address, setAddress] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [dob, setDob] = useState('');

  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  const needsArea = role === 'MANAGER' || role === 'EMPLOYEE';
  const needsRegion = role === 'AREA_ADMIN';

  const valid =
    name.trim().length > 1 &&
    /.+@.+\..+/.test(email) &&
    phone.trim().length > 5 &&
    password.length >= 6 &&
    (!needsArea || areaId) &&
    (!needsRegion || regionId);

  async function uploadDoc(file: File, type: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('docType', type);
    const res = await fetch('/api/ops/staff/doc', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      throw new Error(data.error || `Failed to upload ${type}`);
    }
    return data.url;
  }

  async function submit() {
    setPending(true);
    setState({});
    try {
      let aadharCardUrl: string | undefined;
      let panCardUrl: string | undefined;

      if (aadharFile) {
        aadharCardUrl = await uploadDoc(aadharFile, 'AADHAR');
      }
      if (panFile) {
        panCardUrl = await uploadDoc(panFile, 'PAN');
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password: password.trim(),
          role,
          areaId: needsArea ? areaId : undefined,
          regionId: needsRegion ? regionId : undefined,
          aadharNumber: aadharNumber.trim() || undefined,
          aadharCardUrl,
          panNumber: panNumber.trim().toUpperCase() || undefined,
          panCardUrl,
          address: address.trim() || undefined,
          emergencyContactName: emergencyContactName.trim() || undefined,
          emergencyPhone: emergencyPhone.trim() || undefined,
          dob: dob || undefined,
        }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setState({ error: data.error ?? 'Could not add that person.' });
        return;
      }
      setState({ ok: data.message ?? 'User added successfully with KYC records.' });
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setAadharNumber('');
      setAadharFile(null);
      setPanNumber('');
      setPanFile(null);
      setAddress('');
      setEmergencyContactName('');
      setEmergencyPhone('');
      setDob('');
      router.refresh();
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : 'No connection or upload failed.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4" suppressHydrationWarning>
      {/* Basic & Account Details */}
      <div>
        <label className="field-label" htmlFor="u-role">Role</label>
        <select
          id="u-role"
          className="field"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ASSIGNABLE.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-mute">{ROLE_BLURB[role]}</p>
      </div>

      <div>
        <label className="field-label" htmlFor="u-name">Name *</label>
        <input id="u-name" className="field" placeholder="e.g. Rahul Sharma" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="field-label" htmlFor="u-email">Login email *</label>
          <input id="u-email" className="field" inputMode="email" placeholder="e.g. rahul@carzz.app" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="u-phone">Mobile *</label>
          <input id="u-phone" className="field" inputMode="tel" placeholder="e.g. 9822100001" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="u-pass">Starting password *</label>
        <input id="u-pass" className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
      </div>

      {needsRegion ? (
        <div>
          <label className="field-label" htmlFor="u-region">Assigned Region *</label>
          <select id="u-region" className="field" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      {needsArea ? (
        <div>
          <label className="field-label" htmlFor="u-area">Assigned Area *</label>
          <select id="u-area" className="field" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      {/* KYC & Identity Verification */}
      {/* KYC Documents (Aadhaar or PAN) */}
      <div className="rounded-xl border border-line-soft bg-surface-elevated/40 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-ink">KYC & Identity Verification</span>
            <p className="text-[10px] text-ink-mute font-medium">Select & verify at least 1 document</p>
          </div>
          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
            🔒 Encrypted
          </span>
        </div>

        {/* Selection Option at Top */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-lg border border-line bg-surface">
          <button
            type="button"
            onClick={() => setKycDocType('aadhaar')}
            className={`py-1.5 px-2 rounded text-xs font-bold transition-all text-center ${
              kycDocType === 'aadhaar'
                ? 'bg-navy-800 text-white shadow-2xs'
                : 'text-ink-mute hover:text-ink hover:bg-surface-raised'
            }`}
          >
            🪪 Aadhaar Card
          </button>
          <button
            type="button"
            onClick={() => setKycDocType('pan')}
            className={`py-1.5 px-2 rounded text-xs font-bold transition-all text-center ${
              kycDocType === 'pan'
                ? 'bg-navy-800 text-white shadow-2xs'
                : 'text-ink-mute hover:text-ink hover:bg-surface-raised'
            }`}
          >
            💳 PAN Card
          </button>
        </div>

        {/* Selected Upload Card (Full Width) */}
        {kycDocType === 'aadhaar' ? (
          <div className="w-full space-y-2 p-2.5 rounded-lg border border-line bg-surface">
            <label className="field-label text-xs font-bold text-ink flex items-center justify-between" htmlFor="u-aadhar">
              <span>Aadhaar Number (UID)</span>
              <span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.5 rounded">12-Digit</span>
            </label>
            <input
              id="u-aadhar"
              className="field text-xs font-mono"
              placeholder="12-digit UID (e.g. 5421 8901 2345)"
              maxLength={14}
              value={aadharNumber}
              onChange={(e) => setAadharNumber(e.target.value)}
            />
            <div className="flex items-center justify-between pt-1">
              <label className="field-label text-[11px]" htmlFor="u-aadhar-file">Aadhaar Copy (Image or PDF)</label>
              <span className="text-[10px] text-slate-600 font-semibold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">📏 Max 10MB</span>
            </div>
            <input
              id="u-aadhar-file"
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                if (f && f.size > 10 * 1024 * 1024) {
                  const sizeMB = (f.size / (1024 * 1024)).toFixed(1);
                  alert(`File "${f.name}" (${sizeMB}MB) exceeds the maximum allowed limit of 10MB. Please select a smaller file.`);
                  e.target.value = '';
                  setAadharFile(null);
                  return;
                }
                setAadharFile(f);
              }}
              className="block w-full text-xs text-ink-mute file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border file:border-line file:text-xs file:font-semibold file:bg-surface file:text-ink hover:file:bg-surface-elevated cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 font-medium">PDF, PNG, JPG, or WebP · Max 10MB limit</p>
          </div>
        ) : (
          <div className="w-full space-y-2 p-2.5 rounded-lg border border-line bg-surface">
            <label className="field-label text-xs font-bold text-ink flex items-center justify-between" htmlFor="u-pan">
              <span>PAN Card Number</span>
              <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">10-Digit</span>
            </label>
            <input
              id="u-pan"
              className="field text-xs font-mono uppercase"
              placeholder="e.g. ABCDE1234F"
              maxLength={10}
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
            />
            <div className="flex items-center justify-between pt-1">
              <label className="field-label text-[11px]" htmlFor="u-pan-file">PAN Card Copy (Image or PDF)</label>
              <span className="text-[10px] text-slate-600 font-semibold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">📏 Max 10MB</span>
            </div>
            <input
              id="u-pan-file"
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                if (f && f.size > 10 * 1024 * 1024) {
                  const sizeMB = (f.size / (1024 * 1024)).toFixed(1);
                  alert(`File "${f.name}" (${sizeMB}MB) exceeds the maximum allowed limit of 10MB. Please select a smaller file.`);
                  e.target.value = '';
                  setPanFile(null);
                  return;
                }
                setPanFile(f);
              }}
              className="block w-full text-xs text-ink-mute file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border file:border-line file:text-xs file:font-semibold file:bg-surface file:text-ink hover:file:bg-surface-elevated cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 font-medium">PDF, PNG, JPG, or WebP · Max 10MB limit</p>
          </div>
        )}
      </div>

      {/* Address & Emergency Details */}
      <div className="rounded-xl border border-line-soft bg-surface-elevated/40 p-3 space-y-2.5">
        <span className="text-xs font-bold text-ink">Personal & Emergency Details (Optional)</span>

        <div>
          <label className="field-label text-xs" htmlFor="u-address">Address</label>
          <input
            id="u-address"
            className="field text-xs"
            placeholder="Residential address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="field-label text-xs" htmlFor="u-emer-name">Emergency Contact</label>
            <input
              id="u-emer-name"
              className="field text-xs"
              placeholder="Contact Person"
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label text-xs" htmlFor="u-emer-phone">Emergency Phone</label>
            <input
              id="u-emer-phone"
              className="field text-xs"
              placeholder="Phone number"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="field-label text-xs" htmlFor="u-dob">Date of Birth</label>
          <input
            id="u-dob"
            type="date"
            className="field text-xs"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
        </div>
      </div>

      <Button block className="mt-4" disabled={!valid || pending} onClick={submit}>
        {pending ? 'Uploading & Creating User…' : `Add ${ROLE_LABEL[role]}`}
      </Button>

      {state.ok ? <div className="mt-2"><Note tone="success">{state.ok}</Note></div> : null}
      {state.error ? <div className="mt-2"><Note tone="danger">{state.error}</Note></div> : null}
    </div>
  );
}
