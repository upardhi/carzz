'use client';

import { useState } from 'react';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';

interface PhotoPreviewModalProps {
  kind: 'before' | 'after';
  url: string;
  onClose: () => void;
}

export function PhotoPreviewModal({ kind, url, onClose }: PhotoPreviewModalProps) {
  const title = kind === 'before' ? 'Before-Wash Photo' : 'After-Wash Photo';
  const initialResolved = resolvePublicPhotoUrl(url) || url;
  const [currentSrc, setCurrentSrc] = useState<string>(initialResolved);
  const [hasError, setHasError] = useState(false);

  function handleError() {
    // If direct load failed and it's a private blob URL, retry via proxy
    if (url.includes('.private.blob.vercel-storage.com') && !currentSrc.startsWith('/api/photos')) {
      setCurrentSrc(`/api/photos?url=${encodeURIComponent(url)}`);
    } else {
      setHasError(true);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 md:p-6"
    >
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-[#081429] sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-[#1e3a6a] sm:shadow-2xl">
        {/* Top Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0c1e3d] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5 pr-2">
            <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
            <div className="min-w-0">
              <h2 id="preview-modal-title" className="truncate text-sm sm:text-base font-bold text-white">
                {title}
              </h2>
              <p className="truncate text-[11px] text-emerald-400 font-medium">✓ Uploaded & Confirmed</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo preview"
            className="flex h-9 w-9 shrink-0 aspect-square items-center justify-center rounded-full border border-white/15 bg-white/10 text-gray-200 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Full Image Display Container */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black p-2 sm:min-h-[380px] sm:max-h-[500px]">
          {hasError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <span className="text-3xl mb-2">⚠️</span>
              <p className="text-sm font-semibold text-white">Could not preview photo</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                The image storage token may be missing or inaccessible. The photo is securely saved on the server.
              </p>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={currentSrc}
              alt={`${title} Preview`}
              onError={handleError}
              className="max-h-full max-w-full rounded-lg object-contain shadow-md"
            />
          )}
        </div>

        {/* Bottom Close Action Bar */}
        <div className="shrink-0 bg-[#0c1e3d] border-t border-white/10 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-white/10 py-3 text-xs sm:text-sm font-semibold text-white hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
