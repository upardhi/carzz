'use client';

import { WhatsAppChatView } from './WhatsAppChatView';

interface WhatsAppTrackRecordProps {
  isOpen?: boolean;
  onClose?: () => void;
  standalone?: boolean;
  initialBatchId?: string | null;
  initialStatusFilter?: string;
  initialContactKey?: string;
}

export function WhatsAppTrackRecord({
  isOpen = true,
  onClose,
  standalone = false,
  initialContactKey,
}: WhatsAppTrackRecordProps) {
  if (!isOpen) return null;

  const chatContent = (
    <WhatsAppChatView initialContactKey={initialContactKey} />
  );

  if (standalone) {
    return <div className="w-full">{chatContent}</div>;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-navy-950/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="relative w-full max-w-6xl">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-9 right-0 text-white font-bold text-xs bg-white/20 hover:bg-white/30 rounded-full px-3 py-1 shadow-xs transition-colors"
          >
            ✕ Close
          </button>
        )}
        {chatContent}
      </div>
    </div>
  );
}
