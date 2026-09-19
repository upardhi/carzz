'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Note } from '@/components/ui/primitives';
import {
  LEAD_SOURCES,
  WEEKDAY_PATTERNS,
  type LeadSource,
  type WeekdayPattern,
} from '@/lib/data/types';
import { money } from '@/lib/util/format';
import { PATTERN_LABEL } from '@/lib/util/labels';
import { safeOfflineFetch } from '@/lib/util/offlineQueue';
import { toast } from '@/components/ui/ToastProvider';

import { LocationPickerMap } from '@/components/ui/LocationPickerMap';

interface CarDraft {
  model: string;
  make: string;
  colour: string;
  plate: string;
  packageId: string;
  schedulePattern: WeekdayPattern;
  scheduleTime: string;
  specialInstructions: string;
  customDates: string[];
}

export interface IntakeOptions {
  areas: { id: string; name: string; city: string }[];
  packages: { id: string; name: string; price: number; washesPerMonth: number; services?: string[] }[];
  staff: { id: string; name: string; areaId: string }[];
  defaultAreaId: string;
}

export interface InitialEnquiryData {
  enquiryId?: string;
  name?: string;
  phone?: string;
  email?: string;
  areaId?: string;
  locality?: string;
  carCount?: number;
  packageId?: string;
  message?: string;
}

const SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '17:00', '17:30', '18:00', '18:30',
];

const LEAD_SOURCE_CONFIG: Record<LeadSource, { label: string; icon: React.ReactNode }> = {
  GUARD_REF: {
    label: 'Apartment guard reference',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  CUSTOMER_REF: {
    label: 'Customer reference',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M7 15h0M2 9.5h20" />
      </svg>
    ),
  },
  STAFF_REF: {
    label: 'Staff reference',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  DETAILING_CENTRE: {
    label: 'Detailing centre reference',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  ONLINE_ADS: {
    label: 'Instagram / Google ads',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  WEBSITE: {
    label: 'Our website',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  PAMPHLET: {
    label: 'Pamphlet / banner',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  OTHER: {
    label: 'Other',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </svg>
    ),
  },
};

export function AddCustomerForm({
  options,
  onSavedHref,
  initialEnquiry,
}: {
  options: IntakeOptions;
  onSavedHref: string;
  initialEnquiry?: InitialEnquiryData;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<HTMLDivElement>(null);

  const [source, setSource] = useState<LeadSource | ''>(initialEnquiry ? 'WEBSITE' : 'GUARD_REF');
  const [referredById, setReferredById] = useState('');
  const [name, setName] = useState(initialEnquiry?.name ?? '');
  const [phone, setPhone] = useState(initialEnquiry?.phone ?? '');
  const [altPhone, setAltPhone] = useState('');
  const [address, setAddress] = useState(initialEnquiry?.locality ?? '');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [landmark, setLandmark] = useState('');
  const [note, setNote] = useState(initialEnquiry?.message ?? '');
  const [areaId, setAreaId] = useState(
    initialEnquiry?.areaId && options.areas.some((a) => a.id === initialEnquiry.areaId)
      ? initialEnquiry.areaId
      : options.defaultAreaId,
  );
  const [loginEmail, setLoginEmail] = useState(initialEnquiry?.email ?? '');
  const [emailManuallyEdited, setEmailManuallyEdited] = useState(Boolean(initialEnquiry?.email));
  const [loginPassword, setLoginPassword] = useState('');
  const [advance, setAdvance] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'MANUAL_UPI' | 'GATEWAY'>('CASH');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  const handleNameChange = (newName: string) => {
    setName(newName);
    if (!emailManuallyEdited && !initialEnquiry?.email) {
      const slug = newName.toLowerCase().replace(/[^a-z0-9]/g, '');
      setLoginEmail(slug ? `${slug}@carzz.app` : '');
    }
  };

  const initialCarCount = Math.max(1, Math.min(10, initialEnquiry?.carCount ?? 1));
  const defaultPackageId =
    initialEnquiry?.packageId && options.packages.some((p) => p.id === initialEnquiry.packageId)
      ? initialEnquiry.packageId
      : options.packages[0]?.id ?? '';

  const [cars, setCars] = useState<CarDraft[]>(() => {
    return Array.from({ length: initialCarCount }, () => ({
      model: '',
      make: '',
      colour: '',
      plate: '',
      packageId: defaultPackageId,
      schedulePattern: 'MON_THU',
      scheduleTime: '09:00',
      specialInstructions: '',
      customDates: [],
    }));
  });

  const areaStaff = options.staff.filter((s) => s.areaId === areaId);
  const currentArea = options.areas.find((a) => a.id === areaId);

  const monthly = cars.reduce(
    (sum, car) => sum + (options.packages.find((p) => p.id === car.packageId)?.price ?? 0),
    0,
  );
  const washes = cars.reduce(
    (sum, car) =>
      sum + (options.packages.find((p) => p.id === car.packageId)?.washesPerMonth ?? 0),
    0,
  );

  const updateCar = (index: number, patch: Partial<CarDraft>) =>
    setCars((current) => current.map((car, i) => (i === index ? { ...car, ...patch } : car)));

  async function save() {
    if (!source) {
      setError('Choose where this customer came from — it is the only record of what your marketing is worth.');
      sourceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (name.trim().length < 2) {
      setError('Enter the customer\'s full name.');
      return;
    }
    if (phone.trim().length < 6) {
      setError('Enter a valid WhatsApp number.');
      return;
    }
    if (address.trim().length < 4) {
      setError('Enter the garage / hub address — the wash boy needs it to find the car.');
      return;
    }
    if (cars.some((c) => !c.make.trim() || !c.model.trim() || c.plate.trim().length < 4 || !c.schedulePattern)) {
      setError('Each car needs a company, a model, a number plate and wash days.');
      return;
    }
    
    for (const car of cars) {
      if (car.schedulePattern === 'CUSTOM') {
        const pkg = options.packages.find((p) => p.id === car.packageId);
        if (pkg && car.customDates.length !== pkg.washesPerMonth) {
          setError(`For custom dates, you must select exactly ${pkg.washesPerMonth} dates for ${car.make} ${car.model}.`);
          return;
        }
      }
    }

    if (!loginEmail.trim() || !/.+@.+\..+/.test(loginEmail)) {
      setError('Please provide a valid login email for customer app access.');
      return;
    }
    if (!loginPassword || loginPassword.length < 6) {
      setError('Customer starting password must have at least 6 characters.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      const payload = {
        action: 'create',
        source,
        referredById: referredById || undefined,
        name,
        phone,
        altPhone: altPhone || undefined,
        address,
        landmark: landmark || undefined,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        note: note || undefined,
        areaId,
        createLogin: true,
        loginEmail: loginEmail.trim(),
        loginPassword: loginPassword,
        advance: advance ? Math.round(Number(advance)) : undefined,
        paymentMode,
        enquiryId: initialEnquiry?.enquiryId || undefined,
        startDate: startDate || undefined,
        cars: cars.map((car) => ({
          make: car.make,
          model: car.model,
          colour: car.colour || 'Not noted',
          plate: car.plate,
          packageId: car.packageId,
          schedulePattern: car.schedulePattern,
          scheduleTime: car.scheduleTime,
          specialInstructions: car.specialInstructions || undefined,
          customDates: car.schedulePattern === 'CUSTOM' ? car.customDates : undefined,
        })),
      };

      const result = await safeOfflineFetch<{ error?: string; customer?: { id: string } }>('/api/ops/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        label: `Add Customer: ${name.trim()}`,
      });

      if (!result.ok) {
        setError(result.error ?? 'Could not save this customer.');
        return;
      }

      if (result.queuedOffline) {
        toast.info(
          `Customer "${name.trim()}" saved offline. Will automatically create customer as soon as your network reconnects!`,
          { title: 'Saved Offline (Auto-Sync)' }
        );
        router.push(onSavedHref);
        router.refresh();
        return;
      }

      const data = result.data;
      if (!data?.customer) {
        setError('Unexpected response from server.');
        return;
      }

      toast.success(`Customer "${name.trim()}" added successfully.`);
      router.push(`${onSavedHref}/${data.customer.id}`);
      router.refresh();
    } catch {
      setError('Something unexpected happened. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      {initialEnquiry && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
              WEB
            </span>
            <div>
              <p className="font-bold">
                Converting Website Enquiry {initialEnquiry.enquiryId ? `(#${initialEnquiry.enquiryId.slice(-6).toUpperCase()})` : ''}
              </p>
              <p className="text-xs text-blue-700">
                Customer details and requested package have been automatically pre-filled. On saving, this enquiry will be marked as <span className="font-semibold uppercase text-emerald-700">Converted</span>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12" suppressHydrationWarning>
        {/* Left Form Area (8 cols) */}
        <div className="space-y-5 lg:col-span-8">
          {/* Card 1: Referral Source */}
          <div ref={sourceRef} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[13px] font-bold text-white shadow-xs">
                1
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 leading-tight">
                  Referral Source <span className="text-rose-500">*</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">Where did they come from?</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LEAD_SOURCES.map((option) => {
                const conf = LEAD_SOURCE_CONFIG[option];
                const isSelected = source === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSource(option)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <span className={`shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                      {conf.icon}
                    </span>
                    <span className="truncate">{conf.label}</span>
                  </button>
                );
              })}
            </div>

            {source === 'STAFF_REF' && (
              <div className="mt-3.5 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                <label className="block text-xs font-bold text-blue-950 mb-1.5">
                  Which wash boy referred them?
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={referredById}
                  onChange={(e) => setReferredById(e.target.value)}
                >
                  <option value="">Choose wash boy…</option>
                  {areaStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Card 2: Customer Details */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[13px] font-bold text-white shadow-xs">
                2
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 leading-tight">
                  Customer Details <span className="text-rose-500">*</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">Enter the basic information.</p>
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {/* Full Name */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Full name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>
              </div>

              {/* WhatsApp Number */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  WhatsApp number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    inputMode="tel"
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Alternate Number */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Alternate number
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    inputMode="tel"
                    placeholder="e.g. 9876543210"
                    value={altPhone}
                    onChange={(e) => setAltPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Nearby Landmark */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Nearby landmark
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="e.g. Near Ram Mandir"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                  />
                </div>
              </div>

              {/* Address & Interactive Location Picker */}
              <div className="sm:col-span-2">
                <LocationPickerMap
                  address={address}
                  lat={lat}
                  lng={lng}
                  city={currentArea?.city || 'Nagpur'}
                  addressRequired
                  onAddressChange={(newAddress) => setAddress(newAddress)}
                  onCoordinatesChange={(newLat, newLng) => {
                    setLat(newLat);
                    setLng(newLng);
                  }}
                />
              </div>

              {/* Note for the wash boy */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Note for the wash boy
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Ring the bell. Dog in compound. Park at gate side."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Car Information */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[13px] font-bold text-white shadow-xs">
                3
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 leading-tight">
                  Car Information <span className="text-rose-500">*</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">Add one or more cars for this customer.</p>
              </div>
            </div>

            <div className="space-y-3.5">
              {cars.map((car, index) => (
                <div key={index} className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                      <span>🚗</span>
                      <span>Car {index + 1}</span>
                    </div>
                    {cars.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCars((c) => c.filter((_, i) => i !== index))}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Company */}
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Company <span className="text-rose-500">*</span>
                      </label>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="e.g. Maruti"
                        value={car.make}
                        onChange={(e) => updateCar(index, { make: e.target.value })}
                      />
                    </div>

                    {/* Model */}
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Model <span className="text-rose-500">*</span>
                      </label>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="e.g. Swift"
                        value={car.model}
                        onChange={(e) => updateCar(index, { model: e.target.value })}
                      />
                    </div>

                    {/* Colour */}
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">Colour</label>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="e.g. White"
                        value={car.colour}
                        onChange={(e) => updateCar(index, { colour: e.target.value })}
                      />
                    </div>

                    {/* Number Plate */}
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Number plate <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="5" width="20" height="14" rx="2" />
                            <line x1="2" y1="10" x2="22" y2="10" />
                          </svg>
                        </div>
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-semibold uppercase text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          placeholder="e.g. MH31 AB 4412"
                          value={car.plate}
                          onChange={(e) => updateCar(index, { plate: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Wash package */}
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">Wash package</label>
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={car.packageId}
                        onChange={(e) => updateCar(index, { packageId: e.target.value })}
                      >
                        {options.packages.length === 0 ? (
                          <option value="">No packages available</option>
                        ) : (
                          options.packages.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.washesPerMonth} washes — {money(p.price)}
                            </option>
                          ))
                        )}
                      </select>
                      {(() => {
                        const pkg = options.packages.find((p) => p.id === car.packageId);
                        if (!pkg?.services || pkg.services.length === 0) return null;
                        
                        return (
                          <div className="mt-2 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                            {pkg.services.map((s, i) => {
                              const [name, count] = s.split(':');
                              const frequency = count || pkg.washesPerMonth;
                              return (
                                <div key={i} className="flex items-center justify-between text-xs font-medium text-slate-600">
                                  <div className="flex items-center gap-1.5">
                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[9px] text-emerald-600">
                                      ✓
                                    </span>
                                    {name}
                                  </div>
                                  <span className="text-[11px] text-slate-500">{frequency} / mo</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Preferred time */}
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">Preferred time</label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </div>
                        <select
                          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={car.scheduleTime}
                          onChange={(e) => updateCar(index, { scheduleTime: e.target.value })}
                        >
                          {SLOTS.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Wash days */}
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Wash days <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </div>
                        <select
                          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={car.schedulePattern}
                          onChange={(e) =>
                            updateCar(index, { schedulePattern: e.target.value as WeekdayPattern })
                          }
                        >
                          {WEEKDAY_PATTERNS.map((p) => (
                            <option key={p} value={p}>
                              {PATTERN_LABEL[p]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Custom Dates Picker (only shows if CUSTOM pattern is selected) */}
                    {car.schedulePattern === 'CUSTOM' && (() => {
                      const pkg = options.packages.find((p) => p.id === car.packageId);
                      if (!pkg) return null;
                      
                      return (
                        <div className="sm:col-span-2 mt-2">
                          <label className="mb-2 block text-xs font-bold text-slate-700">
                            Select exactly {pkg.washesPerMonth} dates <span className="text-rose-500">*</span>
                          </label>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {Array.from({ length: pkg.washesPerMonth }).map((_, dateIndex) => (
                              <input
                                key={dateIndex}
                                type="date"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                value={car.customDates[dateIndex] || ''}
                                onChange={(e) => {
                                  const newDates = [...car.customDates];
                                  newDates[dateIndex] = e.target.value;
                                  updateCar(index, { customDates: newDates });
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setCars((c) => [
                    ...c,
                    {
                      model: '',
                      make: '',
                      colour: '',
                      plate: '',
                      packageId: options.packages[0]?.id ?? '',
                      schedulePattern: 'MON_THU',
                      scheduleTime:
                        SLOTS[
                          Math.min(
                            SLOTS.indexOf(c[c.length - 1]?.scheduleTime || '09:00') + 1,
                            SLOTS.length - 1,
                          )
                        ],
                      specialInstructions: 'Second car — same building',
                      customDates: [],
                    },
                  ])
                }
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline pt-1"
              >
                <span>+</span>
                <span>Add another car</span>
              </button>
            </div>
          </div>

          {/* Card 4: App Access */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[13px] font-bold text-white shadow-xs">
                4
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 leading-tight">
                  App Access <span className="text-rose-500">*</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Login credentials for mobile app &amp; web portal access.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Login email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="e.g. rahul.sharma@carzz.app"
                    value={loginEmail}
                    onChange={(e) => {
                      setEmailManuallyEdited(true);
                      setLoginEmail(e.target.value);
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Starting password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="At least 6 characters"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: Opening Payment */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[13px] font-bold text-white shadow-xs">
                5
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 leading-tight">
                  Opening Payment (Optional)
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Washes are only scheduled once some payment is collected. Leave blank to add the customer without starting service yet — you can collect payment and start service later from their profile.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Advance collected now (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="e.g. 800 (half) or 1600 (full)"
                    value={advance}
                    onChange={(e) => setAdvance(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Payment mode
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="MANUAL_UPI">UPI</option>
                    <option value="GATEWAY">Card / Gateway</option>
                  </select>
                </div>
              </div>

              {Number(advance) > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Service Start Date
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Because payment is being collected, service starts immediately. Choose the date from which the first wash schedule should be generated based on the car&apos;s pattern.
                  </p>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
              <Note tone="danger">{error}</Note>
            </div>
          )}

          {/* Bottom Actions Bar */}
          <div className="flex flex-col gap-3 sm:flex-row pt-2 pb-8">
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="flex-1 flex flex-col items-center justify-center rounded-xl bg-[#0e2144] py-3 px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#163366] active:scale-[0.99] disabled:opacity-50"
            >
              {pending ? (
                'Saving…'
              ) : Number(advance) > 0 ? (
                <>
                  <span>Save customer</span>
                  <span className="text-[10px] font-normal text-blue-200 mt-0.5">
                    (starts {washes} washes/month)
                  </span>
                </>
              ) : (
                <>
                  <span>Save customer</span>
                  <span className="text-[10px] font-normal text-blue-200 mt-0.5">
                    (service starts after payment)
                  </span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push(onSavedHref)}
              className="rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.99]"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Right Sidebar Area (4 cols) */}
        <div className="space-y-4 lg:col-span-4">
          {/* Promo Branding Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a1832] via-[#0f2347] to-[#1a3d75] p-5 text-white shadow-sm">
            <div className="relative z-10">
              <h3 className="text-lg font-bold leading-tight tracking-tight text-white">
                A cleaner car,
                <br />
                happier people
              </h3>
              <p className="mt-1 text-xs font-medium text-slate-300">
                Trusted by hundreds of car owners in your area.
              </p>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
                    ✓
                  </span>
                  <span>Same-day service</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                    👤
                  </span>
                  <span>Trained wash boys</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] text-white">
                    🛡️
                  </span>
                  <span>Quality you can trust</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">
                    💳
                  </span>
                  <span>Multiple payment options</span>
                </div>
              </div>
            </div>
          </div>

          {/* Service Areas Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-blue-600">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <h4 className="text-sm font-bold text-slate-900">Service Areas</h4>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-3">
              This customer will be assigned to {currentArea?.name || 'their area'}. You can change the area if needed.
            </p>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
              >
                {options.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Monthly Estimate Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-slate-700">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <line x1="8" y1="6" x2="16" y2="6" />
                  <line x1="16" y1="14" x2="16" y2="18" />
                  <path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
                </svg>
              </span>
              <h4 className="text-sm font-bold text-slate-900">Monthly Estimate</h4>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-3.5">Based on the selected package.</p>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-medium">Cars</span>
                <span className="font-bold text-slate-900">{cars.length}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-medium">Washes a month</span>
                <span className="font-bold text-slate-900">{washes}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-medium">Monthly</span>
                <span className="font-bold text-slate-900">{money(monthly)}</span>
              </div>

              <div className="my-2 border-t border-slate-100 pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900">Amount due</span>
                  <span className="text-base font-bold text-blue-600">{money(monthly)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Tips Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-500">💡</span>
              <h4 className="text-sm font-bold text-slate-900">Quick Tips</h4>
            </div>

            <div className="space-y-2 text-xs font-medium text-slate-600">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Collect correct WhatsApp number</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Add landmark for easy location</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Mention any special instructions</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>You can add more cars later</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
