'use client';

import { useState } from 'react';
import { Note } from '@/components/ui/primitives';

import { safeOfflineFetch } from '@/lib/util/offlineQueue';

interface Option {
  id: string;
  label: string;
  washesPerMonth?: number;
  services?: string[];
}

/**
 * The booking form. This is the only thing on the site that writes anything,
 * and it is the join between marketing and operations: what it creates lands
 * in the manager's console as a lead.
 */
export function EnquiryForm({
  areas,
  packages,
}: {
  areas: Option[];
  packages: Option[];
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [areaId, setAreaId] = useState('');
  const [locality, setLocality] = useState('');
  const [carCount, setCarCount] = useState('1');
  const [packageId, setPackageId] = useState('');
  const [message, setMessage] = useState('');

  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  const [submittedData, setSubmittedData] = useState<{
    id?: string;
    name: string;
    phone: string;
    areaLabel: string;
    carCount: string;
    packageId: string;
    packageLabel: string;
    message: string;
  } | null>(null);

  const selectedArea = areas.find((a) => a.id === areaId);
  const selectedPackage = packages.find((p) => p.id === packageId);

  const valid = name.trim().length > 1 && phone.replace(/\D/g, '').length >= 8;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await safeOfflineFetch<{ message?: string; error?: string; enquiryId?: string }>('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          name,
          phone,
          email: email || undefined,
          areaId: areaId || undefined,
          locality: locality || undefined,
          carCount: Number(carCount) || 1,
          packageId: packageId || undefined,
          message: message || undefined,
        },
        label: `Enquiry from ${name.trim()}`,
      });

      if (!result.ok) {
        setError(result.error ?? 'Could not send that. Please try again.');
        return;
      }

      const data = result.data;
      const isOffline = !!result.queuedOffline;
      setIsOfflineSaved(isOffline);

      const reqId = data?.enquiryId 
        ? `RQ-${data.enquiryId.slice(-5).toUpperCase()}` 
        : isOffline 
          ? `OFFLINE-${Math.floor(1000 + Math.random() * 9000)}`
          : `RQ-${Math.floor(10000 + Math.random() * 90000)}`;

      const confirmationMsg = isOffline
        ? `You are currently offline. Your request has been saved securely on your device and will be submitted automatically the moment you are back online!`
        : (data?.message ?? `Thank you, ${name.split(' ')[0]}. We will call you on ${phone} today with the slots free in your area.`);

      setSubmittedData({
        id: reqId,
        name: name.trim(),
        phone: phone.trim(),
        areaLabel: selectedArea ? selectedArea.label : (locality ? locality : 'Nagpur (General)'),
        carCount: carCount,
        packageId: packageId,
        packageLabel: selectedPackage ? selectedPackage.label.split('—')[0].trim() : 'Not selected yet',
        message: confirmationMsg,
      });
      setSent(confirmationMsg);
    } catch {
      setError('Something unexpected happened. Please try again.');
    } finally {
      setPending(false);
    }
  }

  function resetForm() {
    setSent(null);
    setSubmittedData(null);
    setName('');
    setPhone('');
    setEmail('');
    setAreaId('');
    setLocality('');
    setCarCount('1');
    setPackageId('');
    setMessage('');
  }

  if (sent && submittedData) {
    return (
      <div className="space-y-4 text-left animate-in fade-in duration-300">
        {/* 1. Green/Amber Request Received Banner */}
        <div className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 shadow-sm ${
          isOfflineSaved ? 'border-amber-200/90 bg-[#fffbeb]' : 'border-emerald-200/90 bg-[#ebfbf3]'
        }`}>
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className={`flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md ${
                isOfflineSaved ? 'bg-amber-500 shadow-amber-500/20' : 'bg-[#10b981] shadow-emerald-500/20'
              }`}>
                {isOfflineSaved ? (
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 1l22 22" />
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                    <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
                    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                    <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth={3} />
                  </svg>
                ) : (
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div>
                <h4 className="text-lg sm:text-xl font-bold text-[#071739] tracking-tight">
                  {isOfflineSaved ? 'Request saved offline (Auto-Sync)' : 'Request received'}
                </h4>
                <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-md">
                  {submittedData.message}
                </p>
              </div>
            </div>

            {/* Graphic Badge */}
            <div className="hidden sm:flex shrink-0 relative items-center justify-center">
              <div className="flex h-12 w-14 items-center justify-center rounded-2xl bg-white/80 border border-emerald-200/80 shadow-sm p-2 text-emerald-600">
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="3" ry="3" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <path d="m9 16 2 2 4-4" strokeWidth={2.5} />
                </svg>
              </div>
              <span className="absolute -top-1.5 -right-1 text-amber-400 text-xs">✨</span>
            </div>
          </div>
        </div>

        {/* 2. Your Request Summary */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
            <h5 className="text-sm sm:text-base font-bold text-[#071739] tracking-tight">Your request summary</h5>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 tracking-wide">
              Request ID: #{submittedData.id}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {/* Name */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-3.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-blue-600 text-xs mb-1">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="shrink-0">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">Name</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 break-words leading-tight">{submittedData.name}</p>
            </div>

            {/* Mobile number */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-3.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-blue-600 text-xs mb-1">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="shrink-0">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">Mobile</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 break-all leading-tight">{submittedData.phone}</p>
            </div>

            {/* Area */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-3.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-blue-600 text-xs mb-1">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="shrink-0">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">Area</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 break-words leading-tight">{submittedData.areaLabel}</p>
            </div>

            {/* Cars */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-3.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-blue-600 text-xs mb-1">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="shrink-0">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2" />
                  <circle cx="7" cy="17" r="2" />
                  <path d="M9 17h6" />
                  <circle cx="17" cy="17" r="2" />
                </svg>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">Cars</span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-900">{submittedData.carCount} {Number(submittedData.carCount) === 1 ? 'car' : 'cars'}</p>
            </div>

            {/* Preferred package */}
            <div className="col-span-2 sm:col-span-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-3.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-blue-600 text-xs mb-1">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="shrink-0">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">Preferred Package</span>
              </div>
              <div className="mt-1">
                <p className="text-xs sm:text-sm font-bold text-slate-900 break-words leading-tight">{submittedData.packageLabel}</p>
                {(() => {
                  const pkg = packages.find(p => p.id === submittedData.packageId);
                  if (!pkg?.services || pkg.services.length === 0) return null;
                  return (
                    <div className="mt-1.5 space-y-1">
                      {pkg.services.map((s, i) => {
                        const [name, count] = s.split(':');
                        const frequency = count || pkg.washesPerMonth;
                        return (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-emerald-100 text-[7px] text-emerald-600">✓</span>
                            <span>{name} ({frequency}/mo)</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Blue Info Banner */}
        <div className="rounded-2xl border border-blue-100 bg-[#edf5ff] p-4 sm:p-4.5 flex items-center gap-3.5 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-sm">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-[#071739] leading-tight">
              Our team will call you shortly to confirm your preferred time slot.
            </p>
            <p className="mt-0.5 text-[11px] sm:text-xs font-semibold text-slate-500">
              No calls, no chasing — just a quick confirmation.
            </p>
          </div>
        </div>

        {/* 4. What Happens Next? */}
        <div className="rounded-2xl border border-slate-200/90 bg-[#f8fafc]/90 p-5 sm:p-6 shadow-sm">
          <h5 className="text-sm sm:text-base font-bold text-[#071739] tracking-tight mb-4">What happens next?</h5>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4 sm:gap-2">
            {/* Step 1 */}
            <div className="flex flex-col">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-xs mb-2.5">
                1
              </div>
              <h6 className="text-xs sm:text-sm font-semibold text-slate-900">We review your request</h6>
              <p className="mt-1 text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed">
                Our team checks availability in your area.
              </p>
            </div>

            {/* Arrow 1 */}
            <div className="hidden sm:flex items-center justify-center px-1 text-blue-400">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-xs mb-2.5">
                2
              </div>
              <h6 className="text-xs sm:text-sm font-semibold text-slate-900">We call you</h6>
              <p className="mt-1 text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed">
                We confirm the best time slot that works for you.
              </p>
            </div>

            {/* Arrow 2 */}
            <div className="hidden sm:flex items-center justify-center px-1 text-blue-400">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-xs mb-2.5">
                3
              </div>
              <h6 className="text-xs sm:text-sm font-semibold text-slate-900">You get your wash</h6>
              <p className="mt-1 text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed">
                Our trained wash boy comes to your location on time.
              </p>
            </div>
          </div>
        </div>

        {/* 5. Gold Trust Banner */}
        <div className="rounded-2xl border border-amber-200/90 bg-[#fffbeb] p-4 flex items-center gap-3.5 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-sm">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-amber-950 leading-tight">
              Safe. Simple. Trusted.
            </p>
            <p className="mt-0.5 text-[11px] sm:text-xs font-semibold text-amber-800/85">
              No advance payment • Verified wash staff • Before &amp; after photos
            </p>
          </div>
        </div>

        {/* Back / Submit another button */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={resetForm}
            className="text-xs font-bold text-slate-500 hover:text-[#071739] transition-colors underline"
          >
            ← Submit another enquiry
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" suppressHydrationWarning>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="e-name">Your name</label>
        <input id="e-name" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" value={name} required
          onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="e-phone">Mobile number</label>
        <input id="e-phone" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" inputMode="tel" required value={phone}
          onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="e-area">Which area?</label>
        <select id="e-area" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" value={areaId}
          onChange={(e) => setAreaId(e.target.value)}>
          <option value="">Not sure / not listed</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="e-locality">Your building or road</label>
        <input id="e-locality" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" value={locality}
          onChange={(e) => setLocality(e.target.value)}
          placeholder="e.g. Sai Residency, near Ram Mandir" />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="e-cars">How many cars?</label>
        <select id="e-cars" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" value={carCount}
          onChange={(e) => setCarCount(e.target.value)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}{n === 5 ? '+' : ''}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="e-package">Package you want</label>
        <select id="e-package" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" value={packageId}
          onChange={(e) => setPackageId(e.target.value)}>
          <option value="">Help me choose</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        {selectedPackage?.services && selectedPackage.services.length > 0 && (
          <div className="mt-2 space-y-1.5 rounded-xl border border-blue-100 bg-blue-50/50 p-2.5">
            {selectedPackage.services.map((s, i) => {
              const [name, count] = s.split(':');
              const frequency = count || selectedPackage.washesPerMonth;
              return (
                <div key={i} className="flex items-center justify-between text-xs font-medium text-blue-900">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-200 text-[8px] text-blue-700">
                      ✓
                    </span>
                    {name}
                  </div>
                  <span className="text-[10px] text-blue-600/80">{frequency} / mo</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="sm:col-span-2">
        <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="e-email">Email (optional)</label>
        <input id="e-email" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" inputMode="email" type="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. rahul@example.com" />
      </div>

      <div className="sm:col-span-2">
        <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="e-message">Anything we should know?</label>
        <textarea id="e-message" className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" rows={3} value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Parking, preferred timing, gate access…" />
      </div>

      {error ? (
        <div className="sm:col-span-2"><Note tone="danger">{error}</Note></div>
      ) : null}

      <div className="sm:col-span-2 mt-2">
        <button
          type="submit"
          disabled={!valid || pending}
          className="w-full rounded-xl bg-[#f59e0b] hover:bg-[#e08e0b] disabled:opacity-50 py-3.5 text-sm sm:text-base font-semibold text-[#071739] shadow-lg shadow-amber-500/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {pending ? 'Sending…' : 'Request a call back ➔'}
        </button>
        <p className="mt-2.5 text-center text-xs text-slate-500 font-medium">
          No payment now. We call you, confirm your slot, and only then start.
        </p>
      </div>
    </form>
  );
}
