'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Note } from '@/components/ui/primitives';
import { toast } from '@/components/ui/ToastProvider';
import { money } from '@/lib/util/format';
import { IconIdCard, IconCreditCard } from '@/components/shell/icons';

import { DocumentUploadPreview } from '@/components/ui/DocumentUploadPreview';
import { LocationPickerMap } from '@/components/ui/LocationPickerMap';

const OTHER_DOC_TYPES = [
  { value: 'driving_license', label: 'Driving License' },
  { value: 'police_verification', label: 'Police Verification' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'other', label: 'Other Document' },
];

export function AddStaffForm({
  areas,
  staff,
  referralBonus,
}: {
  areas: { id: string; name: string; city: string }[];
  staff: { id: string; name: string }[];
  referralBonus: number;
}) {
  const router = useRouter();

  // Basic Details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '');
  const [referredByStaffId, setReferredByStaffId] = useState('');

  // KYC: Document Selection
  const [kycDocType, setKycDocType] = useState<'aadhaar' | 'pan'>('aadhaar');
  const [aadharNumber, setAadharNumber] = useState('');
  const [aadharFile, setAadharFile] = useState<File | null>(null);

  // KYC: PAN
  const [panNumber, setPanNumber] = useState('');
  const [panFile, setPanFile] = useState<File | null>(null);

  // Additional Document
  const [otherDocType, setOtherDocType] = useState('driving_license');
  const [otherDocFile, setOtherDocFile] = useState<File | null>(null);

  // Personal & Emergency Contact
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Banking Details
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');

  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  async function uploadPrivateDoc(file: File, docType: string): Promise<string> {
    const docFormData = new FormData();
    docFormData.append('file', file);
    docFormData.append('docType', docType);

    const docRes = await fetch('/api/ops/staff/doc', {
      method: 'POST',
      body: docFormData,
    });

    const docJson = await docRes.json();
    if (!docRes.ok || !docJson.url) {
      throw new Error(docJson.error ?? `Failed to upload ${docType} document.`);
    }
    return docJson.url;
  }

  async function submit() {
    setPending(true);
    setState({});
    try {
      let uploadedAadharUrl: string | undefined = undefined;
      let uploadedPanUrl: string | undefined = undefined;
      let uploadedOtherDocUrl: string | undefined = undefined;

      if (aadharFile || panFile || otherDocFile) {
        setUploadingDocs(true);
        if (aadharFile) {
          uploadedAadharUrl = await uploadPrivateDoc(aadharFile, 'aadhaar');
        }
        if (panFile) {
          uploadedPanUrl = await uploadPrivateDoc(panFile, 'pan');
        }
        if (otherDocFile) {
          uploadedOtherDocUrl = await uploadPrivateDoc(otherDocFile, otherDocType);
        }
        setUploadingDocs(false);
      }

      // Create staff record with all profile and KYC details
      const response = await fetch('/api/ops/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name,
          phone,
          email,
          password,
          areaId,
          referredByStaffId: referredByStaffId || undefined,
          aadharNumber: aadharNumber.trim() || undefined,
          aadharCardUrl: uploadedAadharUrl,
          panNumber: panNumber.trim().toUpperCase() || undefined,
          panCardUrl: uploadedPanUrl,
          documentUrl: uploadedOtherDocUrl || uploadedAadharUrl || uploadedPanUrl,
          documentType: otherDocFile ? otherDocType : aadharFile ? 'aadhaar' : panFile ? 'pan' : undefined,
          address: address.trim() || undefined,
          emergencyPhone: emergencyPhone.trim() || undefined,
          emergencyContactName: emergencyContactName.trim() || undefined,
          bankName: bankName.trim() || undefined,
          bankAccountNumber: bankAccountNumber.trim() || undefined,
          bankIfsc: bankIfsc.trim().toUpperCase() || undefined,
          upiId: upiId.trim() || undefined,
          dob: dob || undefined,
        }),
      });

      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        const err = data.error ?? 'Could not add that staff member.';
        setState({ error: err });
        toast.error(err);
        return;
      }

      const msg = data.message ?? 'Staff member added successfully with KYC details.';
      setState({ ok: msg });
      toast.success(msg);

      // Reset form
      setName('');
      setPhone('');
      setEmail('');
      setPassword('');
      setReferredByStaffId('');
      setAadharNumber('');
      setAadharFile(null);
      setPanNumber('');
      setPanFile(null);
      setOtherDocFile(null);
      setAddress('');
      setEmergencyContactName('');
      setEmergencyPhone('');
      setDob('');
      setUpiId('');
      setBankName('');
      setBankAccountNumber('');
      setBankIfsc('');

      router.refresh();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'No connection or upload failed.';
      setState({ error: errMsg });
      toast.error(errMsg);
    } finally {
      setPending(false);
      setUploadingDocs(false);
    }
  }

  // KYC validation: Aadhaar and PAN are individually optional, but at least ONE must be supplied
  const hasAadhaar = Boolean(aadharNumber.trim().length >= 4 || aadharFile);
  const hasPan = Boolean(panNumber.trim().length >= 4 || panFile);
  const hasKyc = hasAadhaar || hasPan;

  const valid =
    name.trim().length > 1 &&
    phone.trim().length > 5 &&
    /.+@.+\..+/.test(email) &&
    password.length >= 6 &&
    hasKyc;

  return (
    <div className="space-y-4" suppressHydrationWarning>
      {/* 1. Basic Account Info */}
      <div className="rounded-xl border border-line-soft bg-surface-raised/30 p-3.5 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
          <span>👤</span> Basic Information <span className="text-rose-500">*</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-name">
              Full Name *
            </label>
            <input
              id="st-name"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none shadow-2xs"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-phone">
              Mobile Number *
            </label>
            <input
              id="st-phone"
              inputMode="tel"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none shadow-2xs"
              placeholder="e.g. 9822100001"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-email">
              Login Email *
            </label>
            <input
              id="st-email"
              inputMode="email"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none shadow-2xs"
              placeholder="e.g. rahul.sharma@carzz.app"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-pass">
              Starting Password *
            </label>
            <input
              id="st-pass"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none shadow-2xs"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-area">
              Assigned Area *
            </label>
            <select
              id="st-area"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm font-medium text-ink focus:border-navy-500 focus:outline-none shadow-2xs"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-ref">
              Referred By
            </label>
            <select
              id="st-ref"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm font-medium text-ink focus:border-navy-500 focus:outline-none shadow-2xs"
              value={referredByStaffId}
              onChange={(e) => setReferredByStaffId(e.target.value)}
            >
              <option value="">Nobody</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({money(referralBonus)} bonus)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. KYC & Identity Verification (Aadhaar or PAN) */}
      <div className="rounded-xl border border-line-soft bg-surface-raised/30 p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-2.5">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
              <span>🛡️</span> Identity & KYC Verification
            </h4>
            <p className="text-[11px] text-ink-mute font-medium mt-0.5">
              Select one document type. At least ONE verified document is required.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {hasKyc ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                ✓ KYC Provided ({kycDocType === 'aadhaar' ? 'Aadhaar' : 'PAN'})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                ⚠️ Aadhaar or PAN required
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
              🔒 Encrypted
            </span>
          </div>
        </div>

        {/* Selection Option at Top: Select One Verification Type */}
        <div className="rounded-xl border border-line bg-surface p-2.5 space-y-2">
          <div className="block text-xs font-bold text-navy-950">
            Select Verification Document Type <span className="text-rose-500">* (At least 1 required)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setKycDocType('aadhaar')}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                kycDocType === 'aadhaar'
                  ? 'border-blue-600 bg-white text-navy-950 shadow-2xs ring-2 ring-blue-500/20 font-semibold'
                  : 'border-line bg-surface-elevated/50 text-ink-mute hover:text-navy-900 hover:bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-100 text-purple-600">
                  <IconIdCard width={16} height={16} />
                </span>
                <div>
                  <div className="text-xs font-bold">Aadhaar Card Verification</div>
                  <div className="text-[10px] text-ink-mute">12-Digit UID & Upload</div>
                </div>
              </div>
              <input
                type="radio"
                name="staffKycType"
                checked={kycDocType === 'aadhaar'}
                onChange={() => setKycDocType('aadhaar')}
                className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </button>

            <button
              type="button"
              onClick={() => setKycDocType('pan')}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                kycDocType === 'pan'
                  ? 'border-blue-600 bg-white text-navy-950 shadow-2xs ring-2 ring-blue-500/20 font-semibold'
                  : 'border-line bg-surface-elevated/50 text-ink-mute hover:text-navy-900 hover:bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-blue-600">
                  <IconCreditCard width={16} height={16} />
                </span>
                <div>
                  <div className="text-xs font-bold">PAN Card Verification</div>
                  <div className="text-[10px] text-ink-mute">10-Digit PAN & Upload</div>
                </div>
              </div>
              <input
                type="radio"
                name="staffKycType"
                checked={kycDocType === 'pan'}
                onChange={() => setKycDocType('pan')}
                className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </button>
          </div>
        </div>

        {/* Selected Upload Card (Full Width) */}
        {kycDocType === 'aadhaar' ? (
          <div className="w-full rounded-lg border border-line bg-surface p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-line-soft pb-2">
              <span className="text-xs font-bold text-navy-950 flex items-center gap-1.5">
                <span className="text-purple-600"><IconIdCard width={16} height={16} /></span> Aadhaar Card Verification
              </span>
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Primary Identity Document
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-aadhar">
                12-digit Aadhaar Number
              </label>
              <input
                id="st-aadhar"
                maxLength={14}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-mono text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none"
                placeholder="e.g. 5421 8901 2345"
                value={aadharNumber}
                onChange={(e) => setAadharNumber(e.target.value)}
              />
            </div>

            <DocumentUploadPreview
              id="st-aadhar-file"
              label="Aadhaar Copy (Image or PDF)"
              file={aadharFile}
              onFileChange={setAadharFile}
              maxSizeMB={10}
            />
          </div>
        ) : (
          <div className="w-full rounded-lg border border-line bg-surface p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-line-soft pb-2">
              <span className="text-xs font-bold text-navy-950 flex items-center gap-1.5">
                <span className="text-blue-600"><IconCreditCard width={16} height={16} /></span> PAN Card Verification
              </span>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Primary Identity Document
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-pan">
                10-digit PAN Number
              </label>
              <input
                id="st-pan"
                maxLength={10}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs uppercase font-mono text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none"
                placeholder="e.g. ABCDE1234F"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
              />
            </div>

            <DocumentUploadPreview
              id="st-pan-file"
              label="PAN Copy (Image or PDF)"
              file={panFile}
              onFileChange={setPanFile}
              maxSizeMB={10}
            />
          </div>
        )}

        {/* Additional Document (Optional) */}
        <div className="rounded-lg border border-line bg-surface p-3 space-y-3">
          <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5" htmlFor="st-other-doc">
            <span>📑</span> Other Document (Optional)
          </label>
          <div>
            <select
              id="st-other-doc"
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink focus:border-navy-500 focus:outline-none"
              value={otherDocType}
              onChange={(e) => setOtherDocType(e.target.value)}
            >
              {OTHER_DOC_TYPES.map((dt) => (
                <option key={dt.value} value={dt.value}>{dt.label}</option>
              ))}
            </select>
          </div>

          <DocumentUploadPreview
            id="st-other-doc-file"
            label="Verification Document Copy"
            file={otherDocFile}
            onFileChange={setOtherDocFile}
            maxSizeMB={10}
          />
        </div>
      </div>

      {/* 3. Address & Emergency Contact */}
      <div className="rounded-xl border border-line-soft bg-surface-raised/30 p-3.5 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
          <span>📍</span> Address & Emergency Contact (Optional)
        </h4>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-address">
            Residential Address
          </label>
          <LocationPickerMap
            address={address}
            lat={lat}
            lng={lng}
            city={areas.find(a => a.id === areaId)?.city || 'Nagpur'}
            onAddressChange={(newAddress) => setAddress(newAddress)}
            onCoordinatesChange={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-emg-name">
              Emergency Contact Name
            </label>
            <input
              id="st-emg-name"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none shadow-2xs"
              placeholder="e.g. Ramesh (Father / Spouse)"
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-emg-phone">
              Emergency Contact Phone
            </label>
            <input
              id="st-emg-phone"
              inputMode="tel"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none shadow-2xs"
              placeholder="e.g. 9822100099"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-dob">
              Date of Birth
            </label>
            <input
              id="st-dob"
              type="date"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink focus:border-navy-500 focus:outline-none shadow-2xs"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 4. Bank & Payout Details (Optional) */}
      <div className="rounded-xl border border-line-soft bg-surface-raised/30 p-3.5 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-navy-900 flex items-center gap-1.5">
          <span>🏦</span> Bank & Payout Details (Optional)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-upi">
              UPI ID
            </label>
            <input
              id="st-upi"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none shadow-2xs"
              placeholder="e.g. 9822100001@upi"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-bank-name">
              Bank Name
            </label>
            <input
              id="st-bank-name"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none shadow-2xs"
              placeholder="e.g. State Bank of India"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-acc">
              Account Number
            </label>
            <input
              id="st-acc"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm font-mono text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none shadow-2xs"
              placeholder="e.g. 30891234567"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-mute mb-1" htmlFor="st-ifsc">
              IFSC Code
            </label>
            <input
              id="st-ifsc"
              maxLength={11}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:text-sm font-mono uppercase text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none shadow-2xs"
              placeholder="e.g. SBIN0001234"
              value={bankIfsc}
              onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={!valid || pending}
        onClick={submit}
        className="w-full rounded-xl bg-navy-900 py-3 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-navy-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
      >
        {uploadingDocs ? 'Uploading KYC Documents…' : pending ? 'Adding…' : '+ Add Staff Member'}
      </button>

      {state.ok ? (
        <div className="mt-2"><Note tone="success">{state.ok}</Note></div>
      ) : null}
      {state.error ? (
        <div className="mt-2"><Note tone="danger">{state.error}</Note></div>
      ) : null}
    </div>
  );
}


