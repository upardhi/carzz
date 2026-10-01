import { EventEmitter } from 'node:events';

export interface WhatsAppStreamEvent {
  type: 'inbound' | 'receipt' | 'outbound' | 'sync';
  phone?: string;
  metaMessageId?: string;
  status?: string;
  timestamp?: string;
}

const globalForEvents = globalThis as unknown as {
  __whatsappEventBus?: EventEmitter;
};

export const whatsappEventBus: EventEmitter =
  globalForEvents.__whatsappEventBus ?? new EventEmitter();

if (!globalForEvents.__whatsappEventBus) {
  whatsappEventBus.setMaxListeners(200);
  globalForEvents.__whatsappEventBus = whatsappEventBus;
}

export function emitWhatsAppEvent(event: WhatsAppStreamEvent): void {
  try {
    whatsappEventBus.emit('whatsapp_event', event);
  } catch (err) {
    console.error('[WhatsAppEventBus] Failed to emit event:', err);
  }
}
