/**
 * Centralized WhatsApp Message Templates
 * Single source of truth for all WhatsApp customer & staff notifications.
 * Formatted with polite greetings, uppercase plates, bold values, and rich plan inclusions.
 * Defensive sanitization guarantees NO 'NaN', 'undefined', or 'null' values ever render.
 */

export function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://carzs.vercel.app')
  );
}

// ============================================================================
// DEFENSIVE SANITIZATION UTILITIES
// ============================================================================

export function cleanStr(val: unknown, fallback: string = ''): string {
  if (val === null || val === undefined) return fallback;
  const s = String(val).trim();
  if (
    !s ||
    s.toLowerCase() === 'nan' ||
    s.toLowerCase() === 'undefined' ||
    s.toLowerCase() === 'null' ||
    s === '—'
  ) {
    return fallback;
  }
  return s;
}

export function cleanPlate(plate: unknown, fallback: string = 'YOUR VEHICLE'): string {
  const p = cleanStr(plate, fallback);
  return p.toUpperCase();
}

export function cleanName(name: unknown, fallback: string = 'Valued Customer'): string {
  const n = cleanStr(name, fallback);
  return n.length > 0 ? n : fallback;
}

export function cleanNumber(val: unknown, fallback: number = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  const parsed = Number(val);
  return !isNaN(parsed) ? parsed : fallback;
}

export function cleanTime(timeStr: unknown): string | null {
  const s = cleanStr(timeStr, '');
  if (!s || s.includes('NaN') || s.includes('undefined') || s.includes('null') || s === '—') {
    return null;
  }
  return s;
}

function beforeUrl(url?: string | null): string | null {
  const clean = cleanStr(url);
  if (!clean) return null;
  return clean.startsWith('http') ? clean : `${getAppBaseUrl()}${clean}`;
}

function afterUrl(url?: string | null): string | null {
  const clean = cleanStr(url);
  if (!clean) return null;
  return clean.startsWith('http') ? clean : `${getAppBaseUrl()}${clean}`;
}

// ============================================================================
// 1. NEW CUSTOMER WELCOME (With full plan inclusions & features)
// ============================================================================
export interface WelcomeTemplateParams {
  customerName: string;
  carPlate: string;
  packageName: string;
  services?: string[];
  washesPerMonth?: number;
  portalUrl?: string;
}

export function buildWelcomeMessage(params: WelcomeTemplateParams): string {
  const customerName = cleanName(params.customerName, 'Valued Customer');
  const carPlate = cleanPlate(params.carPlate);
  const packageName = cleanStr(params.packageName, 'Standard');
  const washesPerMonth = cleanNumber(params.washesPerMonth, 0);
  const rawServices = params.services || [];
  const services = rawServices.map((s) => cleanStr(s)).filter(Boolean);
  const portalUrl = cleanStr(params.portalUrl, `${getAppBaseUrl()}/app`);

  let inclusionsSection = '';
  const inclusions: string[] = [];

  if (washesPerMonth > 0) {
    inclusions.push(`*${washesPerMonth} Washes* per month`);
  }

  for (const s of services) {
    inclusions.push(s);
  }

  if (inclusions.length > 0) {
    inclusionsSection = `\n\n📦 *Your Plan Inclusions:*\n` + inclusions.map((i) => `• ${i}`).join('\n');
  }

  return (
    `Welcome to Carz, *${customerName}*! 🎉\n\n` +
    `Your car *${carPlate}* is now registered under the *${packageName}* plan.` +
    inclusionsSection +
    `\n\nWe look forward to keeping your vehicle sparkling clean every day!\n` +
    `📲 Track your services & schedule: ${portalUrl}\n\n` +
    `Have a wonderful day! — Team Carz`
  );
}

// ============================================================================
// 2. WASH COMPLETED NOTIFICATION (With services done & before/after photos)
// ============================================================================
export interface WashCompletedTemplateParams {
  customerName: string;
  carPlate: string;
  servicesDone?: string[];
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  feedbackUrl?: string;
}

export function buildWashCompletedMessage(params: WashCompletedTemplateParams): string {
  const customerName = cleanName(params.customerName, 'Valued Customer');
  const carPlate = cleanPlate(params.carPlate);
  const rawServices = params.servicesDone || [];
  const servicesDone = rawServices.map((s) => cleanStr(s)).filter(Boolean);
  const beforePhoto = beforeUrl(params.beforePhotoUrl);
  const afterPhoto = afterUrl(params.afterPhotoUrl);
  const feedbackUrl = cleanStr(params.feedbackUrl);

  let servicesSection = '';
  if (servicesDone.length > 0) {
    servicesSection = `\n\n✨ *Services Completed:*\n` + servicesDone.map((s) => `• ${s}`).join('\n');
  }

  const links: string[] = [];
  if (beforePhoto) links.push(`Before: ${beforePhoto}`);
  if (afterPhoto) links.push(`After: ${afterPhoto}`);

  const photosSection = links.length > 0 ? `\n\n📸 *Inspection Photos:*\n${links.join('\n')}` : '';
  const ratingSection = feedbackUrl ? `\n\n⭐ Please take a moment to rate our service: ${feedbackUrl}` : '';

  return (
    `Hello *${customerName}*, your car *${carPlate}* has been washed and inspected! ✨` +
    servicesSection +
    photosSection +
    ratingSection +
    `\n\nThank you for choosing Carz! Have a wonderful day. — Team Carz`
  );
}

// ============================================================================
// 3. PAYMENT APPROVED CONFIRMATION
// ============================================================================
export interface PaymentApprovedTemplateParams {
  customerName: string;
  amount: number;
  receiptNo: string;
  packageName?: string;
}

export function buildPaymentApprovedMessage(params: PaymentApprovedTemplateParams): string {
  const customerName = cleanName(params.customerName, 'Valued Customer');
  const amount = cleanNumber(params.amount, 0);
  const receiptNo = cleanStr(params.receiptNo, 'RECEIPT');
  const packageName = cleanStr(params.packageName);
  const packageText = packageName ? `\nPlan: *${packageName}*` : '';

  return (
    `Thank you *${customerName}*! 🙏\n\n` +
    `Your payment of *₹${amount.toLocaleString('en-IN')}* has been approved successfully.\n\n` +
    `📄 Receipt: *#${receiptNo}*` +
    packageText +
    `\n\nThank you for choosing Carz! Have a great day ahead. — Team Carz`
  );
}

// ============================================================================
// 4. CAR UNAVAILABLE / WASH SKIPPED
// ============================================================================
export interface WashSkippedTemplateParams {
  customerName: string;
  carPlate: string;
  reason: string;
  rescheduleDateText: string;
}

export function buildWashSkippedMessage(params: WashSkippedTemplateParams): string {
  const customerName = cleanName(params.customerName, 'Valued Customer');
  const carPlate = cleanPlate(params.carPlate);
  const reason = cleanStr(params.reason, 'Car unavailable');
  const rescheduleDateText = cleanStr(params.rescheduleDateText, 'your next scheduled cycle');

  return (
    `Hello *${customerName}*, we could not wash your car *${carPlate}* today due to: *${reason}*.\n\n` +
    `🗓 Rescheduled to: *${rescheduleDateText}*.\n\n` +
    `Please be assured no wash was deducted from your monthly quota. We will make sure your car is attended to on your next scheduled visit!\n\n` +
    `— Team Carz`
  );
}

// ============================================================================
// 5. OUTSTANDING INVOICE RENEWAL REMINDER
// ============================================================================
export interface InvoiceDueTemplateParams {
  customerName: string;
  amount: number;
  dueOnFormatted: string;
  carPlate?: string;
  packageName?: string;
  paymentUrl?: string;
}

export function buildInvoiceDueMessage(params: InvoiceDueTemplateParams): string {
  const customerName = cleanName(params.customerName, 'Valued Customer');
  const amount = cleanNumber(params.amount, 0);
  const dueOnFormatted = cleanStr(params.dueOnFormatted, 'due date');
  const carPlate = cleanStr(params.carPlate) ? cleanPlate(params.carPlate) : '';
  const packageName = cleanStr(params.packageName);
  const paymentUrl = cleanStr(params.paymentUrl, `${getAppBaseUrl()}/app/payments`);

  let vehicleDetails = '';
  if (carPlate && packageName) {
    vehicleDetails = `\n🚗 Vehicle: *${carPlate}* (${packageName})`;
  } else if (carPlate) {
    vehicleDetails = `\n🚗 Vehicle: *${carPlate}*`;
  } else if (packageName) {
    vehicleDetails = `\n📦 Plan: *${packageName}*`;
  }

  return (
    `Hello *${customerName}*, gentle reminder from Carz:\n\n` +
    `Your subscription renewal of *₹${amount.toLocaleString('en-IN')}* is due on *${dueOnFormatted}*.` +
    vehicleDetails +
    `\n\n📲 Tap to pay securely online: ${paymentUrl}\n\n` +
    `Thank you for being our valued customer! Have a wonderful day. — Team Carz`
  );
}

// ============================================================================
// 6. WASHBOY MORNING ROUTE SCHEDULE
// ============================================================================
export interface WashboyScheduleTemplateParams {
  staffName: string;
  count: number;
  dateFormatted?: string;
  routeUrl?: string;
}

export function buildWashboyScheduleMessage(params: WashboyScheduleTemplateParams): string {
  const staffName = cleanName(params.staffName, 'Team Member');
  const count = cleanNumber(params.count, 0);
  const dateFormatted = cleanStr(params.dateFormatted);
  const routeUrl = cleanStr(params.routeUrl, `${getAppBaseUrl()}/staff`);
  const dateText = dateFormatted ? ` for *${dateFormatted}*` : ' today';

  return (
    `Good morning *${staffName}*! 🌅\n\n` +
    `You have *${count} ${count === 1 ? 'car' : 'cars'}* scheduled for your route${dateText}.\n\n` +
    `📍 Tap to view your route and start your day: ${routeUrl}\n\n` +
    `📸 Remember to take clear before and after photos of each vehicle.\n` +
    `Have a great, safe and productive day! — Team Carz`
  );
}

// ============================================================================
// 7. 1-DAY ADVANCE WASH REMINDER (To Customer)
// ============================================================================
export interface AdvanceReminderTemplateParams {
  customerName: string;
  carPlate: string;
  scheduledDateFormatted: string;
  scheduledTimeFormatted: string;
  packageName?: string;
}

export function buildAdvanceReminderMessage(params: AdvanceReminderTemplateParams): string {
  const customerName = cleanName(params.customerName, 'Valued Customer');
  const carPlate = cleanPlate(params.carPlate);
  const scheduledDateFormatted = cleanStr(params.scheduledDateFormatted, 'tomorrow');
  const time = cleanTime(params.scheduledTimeFormatted);
  const timeText = time ? ` at approximately *${time}*` : '';
  const packageName = cleanStr(params.packageName);
  const planText = packageName ? `\n📦 Plan: *${packageName}*` : '';

  return (
    `Hello *${customerName}*! 🚗\n\n` +
    `Friendly reminder: Your car *${carPlate}* is scheduled for a wash tomorrow (*${scheduledDateFormatted}*)${timeText}.` +
    planText +
    `\n\n🅿️ Please ensure your vehicle is parked in an accessible spot for our wash expert.\n\n` +
    `Thank you for choosing Carz! Have a wonderful day. — Team Carz`
  );
}

// ============================================================================
// 8. SAME-DAY WASH REMINDER (To Customer)
// ============================================================================
export interface SameDayReminderTemplateParams {
  customerName: string;
  carPlate: string;
  scheduledTimeFormatted: string;
  washboyName?: string | null;
  portalUrl?: string;
}

export function buildSameDayReminderMessage(params: SameDayReminderTemplateParams): string {
  const customerName = cleanName(params.customerName, 'Valued Customer');
  const carPlate = cleanPlate(params.carPlate);
  const time = cleanTime(params.scheduledTimeFormatted);
  const timeText = time ? ` at approximately *${time}*` : '';
  const washboyName = cleanStr(params.washboyName);
  const washboyText = washboyName ? ` by our wash expert *${washboyName}*` : '';
  const portalUrl = cleanStr(params.portalUrl, `${getAppBaseUrl()}/app`);

  return (
    `Good morning *${customerName}*! ☀️\n\n` +
    `Your car *${carPlate}* is scheduled to be washed today${timeText}${washboyText}.\n\n` +
    `📲 Track your service live: ${portalUrl}\n\n` +
    `Have a wonderful day! — Team Carz`
  );
}

// ============================================================================
// 9. WASH SCHEDULED FOR TODAY (When user or staff clicks "Wash Today")
// ============================================================================
export interface WashTodayScheduledTemplateParams {
  customerName: string;
  carPlate: string;
  scheduledTimeFormatted: string;
  washboyName?: string | null;
  portalUrl?: string;
}

export function buildWashTodayScheduledMessage(params: WashTodayScheduledTemplateParams): string {
  const customerName = cleanName(params.customerName, 'Valued Customer');
  const carPlate = cleanPlate(params.carPlate);
  const time = cleanTime(params.scheduledTimeFormatted);
  const timeText = time ? ` at approximately *${time}*` : '';
  const washboyName = cleanStr(params.washboyName);
  const washboyText = washboyName ? ` by our wash expert *${washboyName}*` : '';
  const portalUrl = cleanStr(params.portalUrl, `${getAppBaseUrl()}/app`);

  return (
    `Hello *${customerName}*! 🚗\n\n` +
    `Your car *${carPlate}* has been scheduled for a wash today${timeText}${washboyText}.\n\n` +
    `🅿️ Please ensure your vehicle is parked in an accessible spot.\n` +
    `📲 Track your service live: ${portalUrl}\n\n` +
    `Have a wonderful day! — Team Carz`
  );
}

// ============================================================================
// 10. WASH RESCHEDULED NOTIFICATION (When wash date/time is rescheduled)
// ============================================================================
export interface WashRescheduledTemplateParams {
  customerName: string;
  carPlate: string;
  newDateFormatted: string;
  newTimeFormatted?: string | null;
  washboyName?: string | null;
  reason?: string | null;
  portalUrl?: string;
}

export function buildWashRescheduledMessage(params: WashRescheduledTemplateParams): string {
  const customerName = cleanName(params.customerName, 'Valued Customer');
  const carPlate = cleanPlate(params.carPlate);
  const newDateFormatted = cleanStr(params.newDateFormatted, 'your next scheduled cycle');
  const time = cleanTime(params.newTimeFormatted);
  const timeText = time ? ` at approximately *${time}*` : '';
  const washboyName = cleanStr(params.washboyName);
  const washboyText = washboyName ? `\n👤 Assigned wash expert: *${washboyName}*` : '';
  const reason = cleanStr(params.reason);
  const reasonText = reason ? `\n📌 Note: *${reason}*` : '';
  const portalUrl = cleanStr(params.portalUrl, `${getAppBaseUrl()}/app`);

  return (
    `Hello *${customerName}*! 🗓️\n\n` +
    `Your car wash for *${carPlate}* has been rescheduled to *${newDateFormatted}*${timeText}.` +
    washboyText +
    reasonText +
    `\n\nPlease be assured that no extra wash is deducted from your quota.\n` +
    `📲 View updated schedule: ${portalUrl}\n\n` +
    `Thank you for choosing Carz! Have a wonderful day. — Team Carz`
  );
}

// ============================================================================
// 11. WASHBOY AD-HOC ALERT (When a new wash is assigned to staff for today)
// ============================================================================
export interface WashboyAdhocAlertTemplateParams {
  staffName: string;
  customerName: string;
  carPlate: string;
  scheduledTimeFormatted: string;
  routeUrl?: string;
}

export function buildWashboyAdhocAlertMessage(params: WashboyAdhocAlertTemplateParams): string {
  const staffName = cleanName(params.staffName, 'Team Member');
  const customerName = cleanName(params.customerName, 'Valued Customer');
  const carPlate = cleanPlate(params.carPlate);
  const time = cleanTime(params.scheduledTimeFormatted);
  const timeText = time ? ` at *${time}*` : '';
  const routeUrl = cleanStr(params.routeUrl, `${getAppBaseUrl()}/staff`);

  return (
    `Hello *${staffName}*! 🚗\n\n` +
    `An ad-hoc wash for car *${carPlate}* (*${customerName}*) has been scheduled for your route today${timeText}.\n\n` +
    `📍 Tap to view your updated route: ${routeUrl}\n\n` +
    `Remember to capture clear before & after inspection photos.\n` +
    `— Team Carz`
  );
}

// ============================================================================
// 12. WASH STARTED NOTIFICATION (When staff clicks "Start Wash")
// ============================================================================
export interface WashStartedTemplateParams {
  customerName: string;
  carPlate: string;
  washboyName?: string | null;
  startedTimeFormatted?: string;
  plannedService?: string | null;
  portalUrl?: string;
}

export function buildWashStartedMessage(params: WashStartedTemplateParams): string {
  const customerName = cleanName(params.customerName, 'Valued Customer');
  const carPlate = cleanPlate(params.carPlate);
  const washboyName = cleanStr(params.washboyName);
  const washboyText = washboyName ? ` by our wash expert *${washboyName}*` : '';
  const time = cleanTime(params.startedTimeFormatted);
  const timeText = time ? ` at *${time}*` : '';
  const plannedService = cleanStr(params.plannedService);
  const serviceText = plannedService ? `\n🚿 Service: *${plannedService}*` : '';
  const portalUrl = cleanStr(params.portalUrl, `${getAppBaseUrl()}/app`);

  return (
    `Hello *${customerName}*! 🚿\n\n` +
    `Your car *${carPlate}* is now being washed${washboyText}${timeText}.` +
    serviceText +
    `\n\n✨ Inspection & cleaning in progress.\n` +
    `📲 Watch live progress: ${portalUrl}\n\n` +
    `We'll notify you as soon as your car is sparkling clean! — Team Carz`
  );
}
