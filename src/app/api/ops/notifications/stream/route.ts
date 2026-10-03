import { requireApiSession } from '@/lib/auth/server';
import { whatsappEventBus, type WhatsAppStreamEvent } from '@/lib/services/whatsappEvents';

export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events (SSE) stream for real-time WhatsApp updates.
 * Pushes updates ONLY when WhatsApp calls our webhook.
 * Zero database polling when idle.
 */
export async function GET() {
  try {
    await requireApiSession('visit:view');

    const encoder = new TextEncoder();
    let cleanup: (() => void) | null = null;

    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection confirmation
        controller.enqueue(encoder.encode(`event: connected\ndata: {"connected":true}\n\n`));

        const listener = (event: WhatsAppStreamEvent) => {
          try {
            controller.enqueue(
              encoder.encode(`event: whatsapp\ndata: ${JSON.stringify(event)}\n\n`),
            );
          } catch {
            // Stream closed
          }
        };

        whatsappEventBus.on('whatsapp_event', listener);

        // Keep-alive heartbeat every 25 seconds
        const pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            clearInterval(pingInterval);
          }
        }, 25000);

        cleanup = () => {
          whatsappEventBus.off('whatsapp_event', listener);
          clearInterval(pingInterval);
        };
      },
      cancel() {
        if (cleanup) cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
}
