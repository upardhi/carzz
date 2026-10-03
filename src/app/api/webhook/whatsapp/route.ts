import { NextResponse } from 'next/server';
import {
  recordInboundWhatsAppMessage,
  updateWhatsAppMessageStatus,
} from '@/lib/services/whatsappQueue';
import { emitWhatsAppEvent } from '@/lib/services/whatsappEvents';

/**
 * Meta WhatsApp Cloud API Official Webhook Handler
 *
 * 1. GET: Webhook verification challenge during Meta app setup
 * 2. POST: Inbound customer messages and delivery receipts from Meta
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const expectedToken =
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'carz_whatsapp_verify_token';

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[WhatsApp Webhook] Verification successful for Meta challenge');
      return new Response(challenge || '', { status: 200 });
    }

    console.warn('[WhatsApp Webhook] Verification failed: Invalid token or mode');
    return new Response('Forbidden', { status: 403 });
  } catch (error) {
    console.error('[WhatsApp Webhook Error]', error);
    return new Response('Internal Error', { status: 500 });
  }
}

interface MetaWebhookContact {
  wa_id?: string;
  profile?: {
    name?: string;
  };
}

interface MetaWebhookMessage {
  id?: string;
  from?: string;
  type?: string;
  timestamp?: string;
  text?: { body?: string };
  image?: { caption?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
}

interface MetaWebhookStatus {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: Array<{ message?: string; title?: string }>;
}

interface MetaWebhookValue {
  messages?: MetaWebhookMessage[];
  contacts?: MetaWebhookContact[];
  statuses?: MetaWebhookStatus[];
}

interface MetaWebhookChange {
  value?: MetaWebhookValue;
}

interface MetaWebhookEntry {
  changes?: MetaWebhookChange[];
}

interface MetaWebhookBody {
  object?: string;
  entry?: MetaWebhookEntry[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as MetaWebhookBody | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: 'Empty payload' }, { status: 400 });
    }

    if (body.object === 'whatsapp_business_account' && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          const value = change?.value;
          if (!value) continue;

          // Parse incoming messages from customers
          if (Array.isArray(value.messages)) {
            for (const msg of value.messages) {
              const from = msg.from;
              if (!from) continue;

              const contact = (value.contacts || []).find((c) => c.wa_id === from);
              const senderName = contact?.profile?.name || 'Customer';

              let messageText = '';
              const mediaUrl: string | undefined = undefined;

              if (msg.type === 'text') {
                messageText = msg.text?.body || '';
              } else if (msg.type === 'image') {
                messageText = msg.image?.caption || 'Photo';
              } else if (msg.type === 'button') {
                messageText = msg.button?.text || '';
              } else if (msg.type === 'interactive') {
                messageText =
                  msg.interactive?.button_reply?.title ||
                  msg.interactive?.list_reply?.title ||
                  '';
              } else {
                messageText = `[${msg.type || 'Media'} message]`;
              }

              if (messageText) {
                const recorded = recordInboundWhatsAppMessage({
                  from,
                  senderName,
                  message: messageText,
                  mediaUrl,
                  metaMessageId: msg.id,
                  timestamp: msg.timestamp
                    ? new Date(Number(msg.timestamp) * 1000).toISOString()
                    : undefined,
                });

                console.log(
                  `[WhatsApp Inbound] Received reply from ${senderName} (${from}): "${messageText}" (ID: ${recorded.id})`,
                );

                // Push real-time event to connected SSE clients
                emitWhatsAppEvent({
                  type: 'inbound',
                  phone: from,
                  metaMessageId: msg.id,
                  timestamp: recorded.createdAt,
                });
              }
            }
          }

          // Parse delivery and read receipts (sent -> delivered -> read -> failed) from Meta
          if (Array.isArray(value.statuses)) {
            for (const st of value.statuses) {
              const metaMessageId = st.id;
              const statusName = String(st.status || '').toLowerCase();
              const timestamp = st.timestamp
                ? new Date(Number(st.timestamp) * 1000).toISOString()
                : undefined;
              const error = st.errors?.[0]?.message || st.errors?.[0]?.title;

              if (
                metaMessageId &&
                ['sent', 'delivered', 'read', 'failed'].includes(statusName)
              ) {
                updateWhatsAppMessageStatus({
                  metaMessageId,
                  status: statusName as 'sent' | 'delivered' | 'read' | 'failed',
                  timestamp,
                  errorMessage: error,
                });

                console.log(
                  `[WhatsApp Webhook] Receipt update for ${metaMessageId}: status="${statusName}"`,
                );

                // Push real-time event to connected SSE clients
                emitWhatsAppEvent({
                  type: 'receipt',
                  metaMessageId,
                  status: statusName,
                  timestamp,
                });
              }
            }
          }
        }
      }
    }

    // Always acknowledge Meta with 200 OK within 20 seconds to prevent retries
    return NextResponse.json({ ok: true, status: 'RECEIVED' });
  } catch (error) {
    console.error('[WhatsApp Webhook Inbound Error]', error);
    return NextResponse.json({ ok: true, error: 'Internal processing error' }, { status: 200 });
  }
}
