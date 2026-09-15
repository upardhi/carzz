'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface LiveCameraModalProps {
  kind: 'before' | 'after';
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function LiveCameraModal({ kind, onCapture, onClose }: LiveCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [capturedBlobUrl, setCapturedBlobUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Check available cameras
  useEffect(() => {
    async function checkDevices() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch {
        // ignore
      }
    }
    void checkDevices();
  }, []);

  // Start live camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setIsInitializing(true);
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Direct camera streaming is not supported on this browser or device.');
      setIsInitializing(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsInitializing(false);
    } catch (err: unknown) {
      console.warn('Primary camera constraint error, trying fallback:', err);
      // Relaxed fallback for desktop webcams / single-camera devices
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setIsInitializing(false);
      } catch (fallbackErr: unknown) {
        const errName = fallbackErr instanceof Error ? fallbackErr.name : '';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          setCameraError('Camera access was denied. Please allow camera permissions in your browser or PWA settings to capture wash photos.');
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          setCameraError('No camera found on this device.');
        } else {
          setCameraError('Unable to access camera. Please ensure no other application is using it and try again.');
        }
        setIsInitializing(false);
      }
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Flip camera between front & rear
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture live snapshot from video frame to canvas
  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Overlay live timestamp & wash stamp watermark
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const watermark = `CARZ ${kind.toUpperCase()} WASH · ${dateStr} ${timeStr}`;

    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    const textWidth = ctx.measureText(watermark).width;
    ctx.fillRect(16, canvas.height - 52, textWidth + 24, 38);
    ctx.fillStyle = '#e8a317';
    ctx.fillText(watermark, 28, canvas.height - 26);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `${kind}-wash-${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        const url = URL.createObjectURL(blob);
        setCapturedBlobUrl(url);
        setCapturedFile(file);
      },
      'image/jpeg',
      0.92
    );
  };

  // Retake photo
  const handleRetake = () => {
    if (capturedBlobUrl) {
      URL.revokeObjectURL(capturedBlobUrl);
    }
    setCapturedBlobUrl(null);
    setCapturedFile(null);
  };

  // Confirm photo
  const handleConfirm = () => {
    if (capturedFile) {
      stopCamera();
      onCapture(capturedFile);
      onClose();
    }
  };

  const title = kind === 'before' ? 'Capture Before-Wash Photo' : 'Capture After-Wash Photo';
  const subtitle =
    kind === 'before'
      ? 'Live snapshot of vehicle condition & number plate before washing.'
      : 'Live snapshot showing vehicle clean finish after washing.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 md:p-6"
    >
      {/* Hidden Canvas for High-Resolution Capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Modal Card Container */}
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-[#081429] sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-[#1e3a6a] sm:shadow-2xl">
        
        {/* Top Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0c1e3d] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5 pr-2">
            <span className="flex h-3 w-3 shrink-0 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <div className="min-w-0">
              <h2 id="camera-modal-title" className="truncate text-sm sm:text-base font-bold text-white tracking-tight">
                {title}
              </h2>
              <p className="truncate text-[11px] text-gray-300 font-medium">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Close camera modal"
            className="flex h-9 w-9 shrink-0 aspect-square items-center justify-center rounded-full border border-white/15 bg-white/10 text-gray-200 hover:bg-white/20 hover:text-white transition-colors"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Viewfinder Frame Container */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black sm:min-h-[380px] sm:max-h-[460px]">
          {capturedBlobUrl ? (
            // Preview of captured photo
            <div className="relative flex h-full w-full items-center justify-center bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedBlobUrl}
                alt="Captured wash preview"
                className="max-h-full max-w-full object-contain"
              />
              <div className="absolute top-3 left-3 rounded-md bg-black/70 px-3 py-1 text-xs font-semibold text-[#e8a317] backdrop-blur-sm border border-white/10 flex items-center gap-1.5">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Photo Captured · Ready to submit
              </div>
            </div>
          ) : cameraError ? (
            // Camera Error / Permission Blocked
            <div className="max-w-sm px-6 py-8 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-900/40 text-red-400 border border-red-500/30 shadow-inner">
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Camera Required</h3>
              <p className="mb-5 text-xs sm:text-sm text-gray-300 font-medium leading-relaxed">{cameraError}</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="rounded-xl bg-[#e8a317] px-5 py-2.5 text-sm font-semibold text-[#081429] shadow-lg hover:bg-[#d49413] transition-colors"
                >
                  Retry Camera Access
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onClose();
                  }}
                  className="rounded-xl border border-white/20 bg-white/5 px-5 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // Live Video Stream & Viewfinder Overlay
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />

              {/* Viewfinder Target Framing Guidelines HUD */}
              <div className="pointer-events-none absolute inset-6 sm:inset-8 rounded-2xl border border-white/25">
                <div className="absolute -top-1 -left-1 h-6 w-6 border-t-4 border-l-4 border-[#e8a317] rounded-tl-sm" />
                <div className="absolute -top-1 -right-1 h-6 w-6 border-t-4 border-r-4 border-[#e8a317] rounded-tr-sm" />
                <div className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-[#e8a317] rounded-bl-sm" />
                <div className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-[#e8a317] rounded-br-sm" />
              </div>

              {/* Live Badge */}
              <div className="absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-[#e8a317] backdrop-blur-md border border-white/10 flex items-center gap-1.5 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                LIVE {kind.toUpperCase()} CAMERA
              </div>

              {/* Flip Camera Button (if multiple cameras detected) */}
              {hasMultipleCameras && (
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="absolute top-3 right-3 flex h-10 w-10 shrink-0 aspect-square items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md border border-white/10 hover:bg-black/80 transition-colors"
                  aria-label="Switch camera"
                >
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M20 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
                    <polyline points="4 8 8 4 12 8" />
                    <line x1="8" y1="4" x2="8" y2="16" />
                    <polyline points="20 16 16 20 12 16" />
                    <line x1="16" y1="20" x2="16" y2="8" />
                  </svg>
                </button>
              )}

              {/* Initializing Spinner */}
              {isInitializing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm">
                  <div className="text-center">
                    <div className="mx-auto mb-2 h-9 w-9 animate-spin rounded-full border-3 border-[#e8a317] border-t-transparent" />
                    <p className="text-xs font-semibold text-gray-200">Starting Camera…</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Shutter & Controls Bar */}
        <div className="shrink-0 bg-[#0c1e3d] border-t border-white/10 px-5 py-4 sm:py-4">
          {capturedBlobUrl ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 rounded-xl border border-white/20 bg-white/10 py-3 text-xs sm:text-sm font-semibold text-gray-200 hover:bg-white/20 active:scale-95 transition-all"
              >
                🔄 Retake Photo
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 rounded-xl bg-[#e8a317] py-3 text-xs sm:text-sm font-semibold text-[#081429] shadow-lg hover:bg-[#d49413] active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Confirm {kind === 'before' ? 'Before' : 'After'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="text-xs font-semibold text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>

              {/* Circular Shutter Button */}
              <button
                type="button"
                onClick={handleSnap}
                disabled={isInitializing || Boolean(cameraError)}
                className="relative flex h-18 w-18 shrink-0 aspect-square items-center justify-center rounded-full border-4 border-white/80 bg-transparent p-1 transition-transform active:scale-90 disabled:opacity-40 hover:border-white shadow-lg"
                aria-label="Capture live photo"
              >
                <span className="h-14 w-14 shrink-0 aspect-square rounded-full bg-[#e8a317] shadow-md flex items-center justify-center text-[#081429] hover:bg-[#d49413] transition-colors">
                  <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </span>
              </button>

              <div className="text-right">
                <span className="inline-block text-[11px] font-semibold text-gray-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                  Live Snapshot
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
