import React from 'react';
import clsx from 'clsx';
import Link from 'next/link';

export interface VehicleCardProps {
  id?: number | string;
  make?: string;
  model?: string;
  name?: string;
  plate?: string;
  package?: string;
  colour?: string;
  doneWashes: number;
  totalWashes: number;
  nextWash?: string;
  active?: boolean;
  imageSrc?: string | { src: string };
  historyHref?: string;
  onPressHistory?: () => void;
  onPressCard?: () => void;
  className?: string;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  make,
  model,
  name,
  plate,
  package: pkgName,
  colour,
  doneWashes,
  totalWashes,
  nextWash,
  active = true,
  imageSrc,
  historyHref,
  onPressHistory,
  onPressCard,
  className,
}) => {
  const displayName = name || `${make || ''} ${model || ''}`.trim() || 'Vehicle';
  const progressPercent = Math.min(
    100,
    Math.round((doneWashes / (totalWashes || 1)) * 100),
  );

  return (
    <div
      onClick={onPressCard}
      className={clsx(
        'rounded-[20px] border border-[#dae7f4] bg-white p-5 shadow-[0_2px_8px_rgba(15,35,71,0.04)] transition-all hover:shadow-md',
        onPressCard && 'cursor-pointer',
        className,
      )}
    >
      {/* Header Row with thumbnail, name/plate, active badge */}
      <div className="flex items-center gap-3.5">
        {imageSrc && (
          <div className="flex h-[48px] w-[80px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={typeof imageSrc === 'string' ? imageSrc : imageSrc.src || ''}
              alt={displayName}
              className="h-[48px] w-[80px] object-contain"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold text-slate-900 leading-tight">
            {displayName}
          </h2>
          {plate && (
            <p className="text-[12px] text-slate-500 font-medium mt-0.5">
              {plate}
            </p>
          )}
        </div>

        <span
          className={clsx(
            'rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
            active
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-600',
          )}
        >
          {active ? 'Active' : 'Paused'}
        </span>
      </div>

      <div className="my-3.5 border-b border-slate-100" />

      {/* Spec rows */}
      <div className="space-y-1.5 text-[12.5px]">
        {pkgName && (
          <div className="flex items-center justify-between border-b border-slate-50 py-1">
            <span className="font-medium text-slate-500">Package</span>
            <span className="font-semibold text-slate-900">{pkgName}</span>
          </div>
        )}

        {colour && (
          <div className="flex items-center justify-between border-b border-slate-50 py-1">
            <span className="font-medium text-slate-500">Colour</span>
            <span className="font-semibold text-slate-900">{colour}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-b border-slate-50 py-1">
          <span className="font-medium text-slate-500">Washes completed</span>
          <span className="font-semibold text-emerald-700">
            {doneWashes} of {totalWashes}
          </span>
        </div>

        {nextWash && (
          <div className="flex items-center justify-between py-1">
            <span className="font-medium text-slate-500">Next wash</span>
            <span className="font-semibold text-[#214f92]">{nextWash}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="my-3.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[#214f92] transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Action button */}
      {historyHref ? (
        <Link
          href={historyHref}
          className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-center text-[12.5px] font-semibold text-[#214f92] transition-colors hover:bg-slate-100 active:scale-[0.99]"
        >
          View wash history & photos →
        </Link>
      ) : onPressHistory ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPressHistory();
          }}
          className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-center text-[12.5px] font-semibold text-[#214f92] transition-colors hover:bg-slate-100 active:scale-[0.99]"
        >
          View wash history & photos →
        </button>
      ) : null}
    </div>
  );
};
