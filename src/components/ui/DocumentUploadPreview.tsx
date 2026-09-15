'use client';

import { useState, useEffect, useRef } from 'react';
import { getSafeDocumentUrl } from '@/lib/util/doc-url';
import { useToast } from '@/components/ui/ToastProvider';

interface DocumentUploadPreviewProps {
  id?: string;
  label: string;
  description?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  existingUrl?: string | null;
  accept?: string;
  maxSizeMB?: number;
  required?: boolean;
}

export function DocumentUploadPreview({
  id,
  label,
  description,
  file,
  onFileChange,
  existingUrl,
  accept = 'application/pdf,image/jpeg,image/png,image/webp',
  maxSizeMB = 5,
  required = false,
}: DocumentUploadPreviewProps) {
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      const safe = getSafeDocumentUrl(existingUrl);
      setPreviewUrl(safe || null);
      setIsPdf(existingUrl ? existingUrl.toLowerCase().endsWith('.pdf') : false);
      return;
    }

    const isPdfFile = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setIsPdf(isPdfFile);

    if (!isPdfFile) {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setPreviewUrl(null);
    }
  }, [file, existingUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (selected) {
      if (selected.size > maxSizeMB * 1024 * 1024) {
        const selectedMB = (selected.size / (1024 * 1024)).toFixed(1);
        const errMsg = `File "${selected.name}" (${selectedMB}MB) exceeds the maximum allowed limit of ${maxSizeMB}MB. Please compress your file or pick a smaller document.`;
        setSizeError(errMsg);
        toast.error(`File too large (${selectedMB}MB)! Maximum allowed size is ${maxSizeMB}MB.`);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      setSizeError(null);
      onFileChange(selected);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSizeError(null);
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const hasContent = Boolean(file || existingUrl);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-bold text-navy-950">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded" title={`Maximum file size allowed by system: ${maxSizeMB}MB`}>
            📏 Max {maxSizeMB}MB
          </span>
          {hasContent && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
              ✓ Document attached
            </span>
          )}
        </div>
      </div>

      {description && (
        <p className="text-[11px] text-ink-mute">{description}</p>
      )}

      {/* Hidden File Input */}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Uploader / Preview Container */}
      {!hasContent ? (
        /* Empty State: Drop / Browse Box */
        <div
          onClick={() => inputRef.current?.click()}
          className="group relative flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-5 text-center transition-all hover:border-blue-500 hover:bg-blue-50/30 cursor-pointer"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform mb-2">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          </div>
          <div className="text-xs font-semibold text-slate-700">
            <span className="text-blue-600 font-bold group-hover:underline">Click to upload</span> or drag and drop
          </div>
          <p className="mt-1 text-[11px] text-slate-500 font-medium">
            PDF, PNG, JPG, or WebP · <span className="font-bold text-amber-700">Max file size limit: {maxSizeMB}MB</span>
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            Ensure your file is compressed under {maxSizeMB}MB before selecting.
          </p>
        </div>
      ) : (
        /* Attached State: Live Preview Card */
        <div className="relative flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 shadow-xs">
          {/* Thumbnail / Document Icon */}
          <div className="flex items-center gap-3 min-w-0">
            {isPdf ? (
              <div
                onClick={() => {
                  if (existingUrl) {
                    window.open(getSafeDocumentUrl(existingUrl), '_blank');
                  }
                }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-200 cursor-pointer hover:bg-rose-100 transition-colors"
                title="PDF Document"
              >
                <span className="text-lg">📕</span>
              </div>
            ) : previewUrl ? (
              <div
                onClick={() => setShowLightbox(true)}
                className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-slate-100 cursor-pointer"
                title="Click to view full size preview"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={label}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-xs">🔍</span>
                </div>
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                <span className="text-lg">📄</span>
              </div>
            )}

            {/* Document Meta */}
            <div className="min-w-0">
              <p className="text-xs font-bold text-navy-950 truncate">
                {file ? file.name : 'Uploaded Document'}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-ink-mute">
                <span>{file ? formatFileSize(file.size) : 'Stored securely'}</span>
                <span>•</span>
                <span className="uppercase font-semibold text-slate-700">
                  {isPdf ? 'PDF Document' : 'Image'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {previewUrl && !isPdf && (
              <button
                type="button"
                onClick={() => setShowLightbox(true)}
                className="rounded-lg border border-line bg-surface-elevated px-2.5 py-1 text-xs font-bold text-ink hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Preview
              </button>
            )}

            {existingUrl && (
              <a
                href={getSafeDocumentUrl(existingUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-line bg-surface-elevated px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors"
              >
                View
              </a>
            )}

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-line bg-surface-elevated px-2.5 py-1 text-xs font-bold text-ink hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Change
            </button>

            <button
              type="button"
              onClick={handleRemove}
              className="rounded-lg border border-rose-200 bg-rose-50 p-1 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
              title="Remove file"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Inline File Size Error Warning */}
      {sizeError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/90 p-2.5 text-xs text-rose-900 shadow-2xs animate-in fade-in">
          <span className="shrink-0 text-sm">⚠️</span>
          <div className="flex-1 font-medium leading-relaxed">
            <span>{sizeError}</span>
          </div>
        </div>
      )}

      {/* Fullscreen Image Lightbox Modal */}
      {showLightbox && previewUrl && (
        <div
          onClick={() => setShowLightbox(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h4 className="text-sm font-bold text-ink">{label} Preview</h4>
              <button
                type="button"
                onClick={() => setShowLightbox(false)}
                className="rounded-lg p-1 text-ink-mute hover:bg-surface-elevated hover:text-ink transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-xl bg-slate-900/10 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={label}
                className="max-h-[65vh] w-auto rounded-lg object-contain shadow-md"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowLightbox(false)}
                className="rounded-xl bg-navy-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-navy-800 cursor-pointer"
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
