import 'server-only';

export interface SendWhatsAppOptions {
  /** Target phone number in any format (e.g. "+91 98765-43210", "9876543210") */
  to: string;

  /** Text message content */
  message: string;

  /** Optional media attachment (image / document) */
  media?: {
    type: 'image' | 'document';
    url: string;
    caption?: string;
    filename?: string;
  };
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  isMock?: boolean;
  error?: string;
}

/**
 * Normalizes any phone number into Meta's required international format without the leading '+'
 * Default assumption for 10-digit numbers is India (+91).
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';

  // Remove all non-numeric characters
  let digits = rawPhone.replace(/\D/g, '');

  // Strip leading 0
  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  // If 10 digits, assume India (+91)
  if (digits.length === 10) {
    digits = `91${digits}`;
  }

  return digits;
}

export function getWhatsAppConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  const testOverridePhone = process.env.WHATSAPP_TEST_OVERRIDE_PHONE
    ? normalizePhoneNumber(process.env.WHATSAPP_TEST_OVERRIDE_PHONE)
    : '';

  const isConfigured = Boolean(
    phoneNumberId &&
      accessToken &&
      !phoneNumberId.includes('placeholder') &&
      !accessToken.includes('placeholder'),
  );

  return { phoneNumberId, businessAccountId, accessToken, testOverridePhone, isConfigured };
}

/**
 * Core reusable function to send a WhatsApp message to any phone number via Meta Cloud API.
 * Supports WHATSAPP_TEST_OVERRIDE_PHONE to safely test all triggers without spamming real customers.
 * Automatically falls back to mock console logging in development if credentials are not configured.
 */
export async function sendWhatsAppMessage(
  options: SendWhatsAppOptions,
): Promise<WhatsAppSendResult> {
  const { to, message, media } = options;
  const originalRecipient = normalizePhoneNumber(to);

  if (!originalRecipient || originalRecipient.length < 10) {
    return {
      success: false,
      error: `Invalid recipient phone number: "${to}"`,
    };
  }

  const { phoneNumberId, accessToken, testOverridePhone, isConfigured } = getWhatsAppConfig();

  // If a test override number is configured, redirect the message safely
  const recipient = testOverridePhone || originalRecipient;
  const isOverridden = Boolean(testOverridePhone && testOverridePhone !== originalRecipient);
  const finalMessage = message;

  // Development / Mock fallback when credentials are not yet set in .env
  if (!isConfigured) {
    console.log('\n======================================================');
    console.log('💬 [WHATSAPP MOCK DISPATCH]');
    console.log(`📱 To: +${recipient} ${isOverridden ? `(OVERRIDDEN from original: ${to})` : `(Original: ${to})`}`);
    if (media) {
      console.log(`📎 Media [${media.type}]: ${media.url}`);
    }
    console.log('📝 Message:\n' + finalMessage);
    console.log('======================================================\n');

    return {
      success: true,
      messageId: `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      isMock: true,
    };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    let payload: Record<string, unknown>;

    if (media) {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: media.type,
        [media.type]: {
          link: media.url,
          caption: media.caption || finalMessage,
          ...(media.filename ? { filename: media.filename } : {}),
        },
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
          preview_url: true,
          body: finalMessage,
        },
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message: string };
    };

    if (!response.ok || !data.messages || data.messages.length === 0) {
      const errMsg = data.error?.message || `HTTP ${response.status}: Failed to send WhatsApp message`;
      console.error('[WhatsApp Cloud API Error]:', errMsg);
      return {
        success: false,
        error: errMsg,
      };
    }

    return {
      success: true,
      messageId: data.messages[0].id,
      isMock: false,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Network error sending WhatsApp message';
    console.error('[WhatsApp Service Exception]:', errMsg);
    return {
      success: false,
      error: errMsg,
    };
  }
}
