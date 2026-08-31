import clsx from 'clsx';

/** The Carz wordmark: a car under a gold rinse arc, matching the app icon. */
export function BrandMark({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={clsx('shrink-0', className)}
      aria-hidden
    >
      <rect width="100" height="100" rx="22" fill="#0e2748" />
      <path
        d="M13 40 Q50 8 87 40"
        fill="none"
        stroke="#e8a317"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <circle cx="50" cy="17" r="3.4" fill="#f5c453" />
      <path
        d="M12 72 L14 63 Q15 58 21 57 L33 56 L40 44 Q42 41 46 41 L63 41 Q67 41 69 44
           L76 56 Q85 58 87 64 L88 72 Q88 76 84 76 L16 76 Q12 76 12 72 Z"
        fill="#dbe7f4"
      />
      <path d="M45 55 L48 46 L61 46 L64 55 Z" fill="#123a63" opacity=".22" />
      <circle cx="31" cy="76" r="9" fill="#061529" />
      <circle cx="31" cy="76" r="4.2" fill="#8fb3d9" />
      <circle cx="70" cy="76" r="9" fill="#061529" />
      <circle cx="70" cy="76" r="4.2" fill="#8fb3d9" />
    </svg>
  );
}

export function BrandLockup({
  subtitle,
  className,
}: {
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <BrandMark size={36} />
      <div className="leading-tight">
        <div className="text-[15px] font-extrabold tracking-tight text-white">
          CARZ<span className="text-gold-500">.</span>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-300">
          {subtitle ?? 'Management'}
        </div>
      </div>
    </div>
  );
}
