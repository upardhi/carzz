import 'server-only';

import type { DataStore } from '@/lib/data/ports/store';
import type { Payment, WashVisit } from '@/lib/data/types';
import { MISS_REASON_LABEL } from '@/lib/util/labels';
import { formatClock, formatDate, formatDateFull, formatTime } from '@/lib/util/format';
import { slotInstant } from '@/lib/util/time';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import {
  enqueueWhatsAppMessage,
  enqueueWhatsAppBatch,
  type EnqueueWhatsAppOptions,
} from './whatsappQueue';
import {
  buildWelcomeMessage,
  buildWashCompletedMessage,
  buildPaymentApprovedMessage,
  buildWashSkippedMessage,
  buildInvoiceDueMessage,
  buildWashboyScheduleMessage,
  buildAdvanceReminderMessage,
  buildSameDayReminderMessage,
  buildWashTodayScheduledMessage,
  buildWashRescheduledMessage,
  buildWashboyAdhocAlertMessage,
  buildWashStartedMessage,
  getAppBaseUrl,
} from './whatsappTemplates';

// ============================================================================
// 0. WASH STARTED NOTIFICATION (When staff clicks "Start Wash")
// ============================================================================
export async function notifyWashStarted(store: DataStore, visitId: string) {
  try {
    const visit = await store.visits.get(visitId);
    if (!visit) return;

    const [customer, car, staff] = await Promise.all([
      store.customers.get(visit.customerId),
      store.cars.get(visit.carId),
      visit.staffId ? store.staff.get(visit.staffId) : Promise.resolve(null),
    ]);
    if (!customer?.phone || !car) return;

    const startedTime = visit.startedAt ? formatClock(visit.startedAt) : undefined;
    const message = buildWashStartedMessage({
      customerName: customer.name,
      carPlate: car.plate,
      washboyName: staff?.name,
      startedTimeFormatted: startedTime,
      plannedService: visit.plannedService || undefined,
      portalUrl: `${getAppBaseUrl()}/app`,
    });

    enqueueWhatsAppMessage({
      to: customer.phone,
      recipientName: customer.name,
      recipientType: 'CUSTOMER',
      recipientId: customer.id,
      event: 'Wash Started',
      message,
      dedupKey: `wash_started_${visitId}`,
    });
  } catch (err) {
    console.error('Error queueing Wash Started WhatsApp notification:', err);
  }
}

// ============================================================================
// 1. WASH COMPLETED NOTIFICATION
// ============================================================================
export async function notifyWashCompleted(store: DataStore, visitId: string) {
  try {
    const visit = await store.visits.get(visitId);
    if (!visit) return;

    const [customer, car] = await Promise.all([
      store.customers.get(visit.customerId),
      store.cars.get(visit.carId),
    ]);
    if (!customer?.phone || !car) return;

    let servicesDone: string[] | undefined;
    if (car.packageId) {
      try {
        const pkg = await store.packages.get(car.packageId);
        if (pkg?.services && pkg.services.length > 0) {
          servicesDone = pkg.services;
        }
      } catch {}
    }

    const feedbackUrl = `${getAppBaseUrl()}/feedback/${visit.id}`;
    const beforeUrl = resolvePublicPhotoUrl(visit.beforePhotoUrl);
    const afterUrl = resolvePublicPhotoUrl(visit.afterPhotoUrl);

    const message = buildWashCompletedMessage({
      customerName: customer.name,
      carPlate: car.plate,
      servicesDone,
      beforePhotoUrl: beforeUrl,
      afterPhotoUrl: afterUrl,
      feedbackUrl,
    });

    enqueueWhatsAppMessage({
      to: customer.phone,
      recipientName: customer.name,
      recipientType: 'CUSTOMER',
      recipientId: customer.id,
      event: 'Wash Completed',
      message,
      mediaUrl: afterUrl || undefined,
      dedupKey: `wash_completed_${visitId}`,
    });
  } catch (err) {
    console.error('Error queueing Wash Completed WhatsApp notification:', err);
  }
}

// ============================================================================
// 2. PAYMENT APPROVED NOTIFICATION
// ============================================================================
export async function notifyPaymentApproved(
  store: DataStore,
  payment: Payment,
  receiptNo: string,
) {
  try {
    const customer = await store.customers.get(payment.customerId);
    if (!customer?.phone) return;

    let packageName: string | undefined;
    try {
      const cars = await store.cars.find({ where: { customerId: customer.id } as never });
      if (cars.length > 0 && cars[0].packageId) {
        const pkg = await store.packages.get(cars[0].packageId);
        if (pkg) packageName = pkg.name;
      }
    } catch {}

    const message = buildPaymentApprovedMessage({
      customerName: customer.name,
      amount: payment.amount,
      receiptNo,
      packageName,
    });

    enqueueWhatsAppMessage({
      to: customer.phone,
      recipientName: customer.name,
      recipientType: 'CUSTOMER',
      recipientId: customer.id,
      event: 'Payment Approved',
      message,
      dedupKey: `payment_approved_${payment.id}`,
    });
  } catch (err) {
    console.error('Error queueing Payment Approved WhatsApp notification:', err);
  }
}

// ============================================================================
// 3. CAR UNAVAILABLE / WASH SKIPPED NOTIFICATION
// ============================================================================
export async function notifyWashSkipped(
  store: DataStore,
  visit: WashVisit,
  reason: string,
  rescheduleDate?: string | null,
) {
  try {
    const [customer, car] = await Promise.all([
      store.customers.get(visit.customerId),
      store.cars.get(visit.carId),
    ]);
    if (!customer?.phone || !car) return;

    const readableReason =
      MISS_REASON_LABEL[reason as keyof typeof MISS_REASON_LABEL] || reason || 'Car unavailable';
    const nextDateText = rescheduleDate ? formatDate(rescheduleDate) : 'your next scheduled cycle';

    const message = buildWashSkippedMessage({
      customerName: customer.name,
      carPlate: car.plate,
      reason: readableReason,
      rescheduleDateText: nextDateText,
    });

    enqueueWhatsAppMessage({
      to: customer.phone,
      recipientName: customer.name,
      recipientType: 'CUSTOMER',
      recipientId: customer.id,
      event: 'Wash Skipped',
      message,
      dedupKey: `wash_skipped_${visit.id}_${visit.scheduledDate}`,
    });
  } catch (err) {
    console.error('Error queueing Wash Skipped WhatsApp notification:', err);
  }
}

// ============================================================================
// 4. OUTSTANDING INVOICE REMINDER
// ============================================================================
export async function notifyInvoiceDue(
  store: DataStore,
  customerId: string,
  amount: number,
  dueOn: string,
) {
  try {
    const customer = await store.customers.get(customerId);
    if (!customer?.phone) return;

    let carPlate: string | undefined;
    let packageName: string | undefined;
    try {
      const cars = await store.cars.find({ where: { customerId } as never });
      if (cars.length > 0) {
        carPlate = cars[0].plate;
        if (cars[0].packageId) {
          const pkg = await store.packages.get(cars[0].packageId);
          if (pkg) packageName = pkg.name;
        }
      }
    } catch {}

    const message = buildInvoiceDueMessage({
      customerName: customer.name,
      amount,
      dueOnFormatted: formatDate(dueOn),
      carPlate,
      packageName,
      paymentUrl: `${getAppBaseUrl()}/app/payments`,
    });

    enqueueWhatsAppMessage({
      to: customer.phone,
      recipientName: customer.name,
      recipientType: 'CUSTOMER',
      recipientId: customer.id,
      event: 'Invoice Due',
      message,
      dedupKey: `invoice_due_${customerId}_${dueOn}`,
    });
  } catch (err) {
    console.error('Error queueing Invoice Due WhatsApp notification:', err);
  }
}

// ============================================================================
// 5. NEW CUSTOMER WELCOME NOTIFICATION (With full plan inclusions & features)
// ============================================================================
export async function notifyNewCustomerWelcome(
  store: DataStore,
  customerId: string,
  carPlate: string,
  packageName: string,
  packageId?: string,
) {
  try {
    const customer = await store.customers.get(customerId);
    if (!customer?.phone) return;

    let pkgServices: string[] | undefined;
    let washesPerMonth: number | undefined;

    // Look up package if packageId provided, or find car by plate/customer
    if (packageId) {
      try {
        const pkg = await store.packages.get(packageId);
        if (pkg) {
          pkgServices = pkg.services;
          washesPerMonth = pkg.washesPerMonth;
        }
      } catch {}
    } else {
      try {
        const cars = await store.cars.find({ where: { customerId } as never });
        const targetCar = cars.find((c) => c.plate.toUpperCase() === carPlate.toUpperCase()) || cars[0];
        if (targetCar?.packageId) {
          const pkg = await store.packages.get(targetCar.packageId);
          if (pkg) {
            pkgServices = pkg.services;
            washesPerMonth = pkg.washesPerMonth;
          }
        }
      } catch {}
    }

    const message = buildWelcomeMessage({
      customerName: customer.name,
      carPlate,
      packageName,
      services: pkgServices,
      washesPerMonth,
      portalUrl: `${getAppBaseUrl()}/app`,
    });

    enqueueWhatsAppMessage({
      to: customer.phone,
      recipientName: customer.name,
      recipientType: 'CUSTOMER',
      recipientId: customer.id,
      event: 'Customer Welcome',
      message,
      dedupKey: `welcome_${customerId}_${carPlate.toUpperCase()}`,
    });
  } catch (err) {
    console.error('Error queueing New Customer Welcome WhatsApp notification:', err);
  }
}

// ============================================================================
// 6. WASHBOY MORNING SCHEDULE NOTIFICATION
// ============================================================================
export async function notifyWashboyMorningSchedule(
  store: DataStore,
  staffId: string,
  date: string,
) {
  try {
    const [staff, visits] = await Promise.all([
      store.staff.get(staffId),
      store.visits.find({
        where: {
          staffId,
          scheduledDate: date,
        } as never,
      }),
    ]);
    if (!staff?.phone) return { staffName: '', count: 0, queued: false, error: 'Staff member has no phone' };

    const activeVisits = visits.filter((v) => v.status !== 'MISSED');
    const count = activeVisits.length;
    const routeUrl = `${getAppBaseUrl()}/staff`;

    const message = buildWashboyScheduleMessage({
      staffName: staff.name,
      count,
      routeUrl,
    });

    enqueueWhatsAppMessage({
      to: staff.phone,
      recipientName: staff.name,
      recipientType: 'STAFF',
      recipientId: staff.id,
      event: 'Morning Route',
      message,
      dedupKey: `staff_schedule_${staffId}_${date}`,
    });

    return { staffName: staff.name, count, queued: true };
  } catch (err) {
    console.error('Error queueing Washboy Morning Schedule WhatsApp notification:', err);
    return { staffName: '', count: 0, queued: false, error: String(err) };
  }
}

// ============================================================================
// 7. SAME-DAY MORNING WASH REMINDER (Replaces 1-day-before per business policy)
// ============================================================================
export async function notifyCustomerDayBeforeReminder(
  store: DataStore,
  visit: WashVisit,
) {
  // NOTE: Reminders are no longer sent 1 day before.
  // They are sent on the same day at 6:00 AM in the morning.
  return notifyCustomerSameDayReminder(store, visit);
}

// ============================================================================
// 8. SAME DAY 6:00 AM WASH REMINDER (Day-of morning customer reminder)
// ============================================================================
export async function notifyCustomerSameDayReminder(
  store: DataStore,
  visit: WashVisit,
) {
  try {
    const [customer, car, staff] = await Promise.all([
      store.customers.get(visit.customerId),
      store.cars.get(visit.carId),
      visit.staffId ? store.staff.get(visit.staffId) : Promise.resolve(null),
    ]);
    if (!customer?.phone || !car) return false;

    const formattedTime = formatTime(visit.scheduledTime);
    const portalUrl = `${getAppBaseUrl()}/app`;

    const message = buildSameDayReminderMessage({
      customerName: customer.name,
      carPlate: car.plate,
      scheduledTimeFormatted: formattedTime,
      washboyName: staff?.name,
      portalUrl,
    });

    // Schedule for 6:00 AM on the scheduled day in business timezone
    const sixAm = slotInstant(visit.scheduledDate, '06:00');
    const delayMs = Math.max(0, sixAm.getTime() - Date.now());

    enqueueWhatsAppMessage({
      to: customer.phone,
      recipientName: customer.name,
      recipientType: 'CUSTOMER',
      recipientId: customer.id,
      event: 'Today Wash Reminder',
      message,
      dedupKey: `same_day_${visit.id}_${visit.scheduledDate}`,
      delayMs,
    });
    return true;
  } catch (err) {
    console.error('Error queueing Same-Day Wash Reminder:', err);
    return false;
  }
}

// ============================================================================
// 9. WASH SCHEDULED FOR TODAY ("Wash Today" ad-hoc trigger)
// ============================================================================
export async function notifyWashScheduledToday(
  store: DataStore,
  visit: WashVisit,
) {
  try {
    const [customer, car, staff] = await Promise.all([
      store.customers.get(visit.customerId),
      store.cars.get(visit.carId),
      visit.staffId ? store.staff.get(visit.staffId) : Promise.resolve(null),
    ]);
    if (!customer?.phone || !car) return false;

    const formattedTime = formatTime(visit.scheduledTime);
    const portalUrl = `${getAppBaseUrl()}/app`;

    const customerMessage = buildWashTodayScheduledMessage({
      customerName: customer.name,
      carPlate: car.plate,
      scheduledTimeFormatted: formattedTime,
      washboyName: staff?.name,
      portalUrl,
    });

    enqueueWhatsAppMessage({
      to: customer.phone,
      recipientName: customer.name,
      recipientType: 'CUSTOMER',
      recipientId: customer.id,
      event: 'Today Wash Reminder',
      message: customerMessage,
      dedupKey: `wash_today_cust_${visit.id}_${visit.scheduledDate}`,
    });

    // Alert assigned staff on their phone as well
    if (staff?.phone) {
      const staffMessage = buildWashboyAdhocAlertMessage({
        staffName: staff.name,
        customerName: customer.name,
        carPlate: car.plate,
        scheduledTimeFormatted: formattedTime,
        routeUrl: `${getAppBaseUrl()}/staff`,
      });

      enqueueWhatsAppMessage({
        to: staff.phone,
        recipientName: staff.name,
        recipientType: 'STAFF',
        recipientId: staff.id,
        event: 'Morning Route',
        message: staffMessage,
        dedupKey: `wash_today_staff_${visit.id}_${staff.id}`,
      });
    }

    return true;
  } catch (err) {
    console.error('Error queueing Wash Scheduled Today WhatsApp notification:', err);
    return false;
  }
}

// ============================================================================
// 10. WASH RESCHEDULED NOTIFICATION (When wash date/time is rescheduled)
// ============================================================================
export async function notifyWashRescheduled(
  store: DataStore,
  visitId: string,
  newDate: string,
  newTime?: string,
  reason?: string | null,
) {
  try {
    const visit = await store.visits.get(visitId);
    if (!visit) return false;

    const [customer, car, staff] = await Promise.all([
      store.customers.get(visit.customerId),
      store.cars.get(visit.carId),
      visit.staffId ? store.staff.get(visit.staffId) : Promise.resolve(null),
    ]);
    if (!customer?.phone || !car) return false;

    const formattedDate = formatDateFull(newDate);
    const formattedTime = formatTime(newTime || visit.scheduledTime);

    const message = buildWashRescheduledMessage({
      customerName: customer.name,
      carPlate: car.plate,
      newDateFormatted: formattedDate,
      newTimeFormatted: formattedTime,
      washboyName: staff?.name,
      reason,
      portalUrl: `${getAppBaseUrl()}/app`,
    });

    enqueueWhatsAppMessage({
      to: customer.phone,
      recipientName: customer.name,
      recipientType: 'CUSTOMER',
      recipientId: customer.id,
      event: 'Wash Skipped',
      message,
      dedupKey: `wash_rescheduled_${visitId}_${newDate}_${newTime || ''}`,
    });

    return true;
  } catch (err) {
    console.error('Error queueing Wash Rescheduled WhatsApp notification:', err);
    return false;
  }
}

// ============================================================================
// HIGH-SCALE BATCH DISPATCH HELPERS (Supports 50,000+ jobs effortlessly)
// ============================================================================

/** Broadcast morning schedule to all active washboys for a given date */
export async function broadcastWashboySchedules(
  store: DataStore,
  date: string,
  targetStaffId?: string,
) {
  const staffList = targetStaffId
    ? [await store.staff.get(targetStaffId)].filter(Boolean)
    : await store.staff.find({ where: { role: 'EMPLOYEE', active: true } as never });

  const results = [];
  for (const s of staffList) {
    if (!s || !s.phone) continue;
    const res = await notifyWashboyMorningSchedule(store, s.id, date);
    results.push(res);
  }
  return results;
}

/**
 * Broadcast customer reminders.
 * NOTE: 1-day advance reminders are disabled per business policy.
 * Customers receive reminders on the same day at 6:00 AM.
 * Kept for backwards compatibility; redirects to same-day 6:00 AM reminder.
 */
export async function broadcastCustomerDayBeforeReminders(
  store: DataStore,
  targetDate: string,
) {
  return broadcastCustomerSameDayReminders(store, targetDate);
}

/** Broadcast same-day 6:00 AM morning wash reminder to all customers scheduled for today (Batched) */
export async function broadcastCustomerSameDayReminders(
  store: DataStore,
  targetDate: string,
) {
  const visits = await store.visits.find({
    where: { scheduledDate: targetDate, status: 'PENDING' } as never,
  });

  const seenCars = new Set<string>();
  const jobs: EnqueueWhatsAppOptions[] = [];

  // Calculate delay until 6:00 AM on the target date (Asia/Kolkata business time)
  const sixAm = slotInstant(targetDate, '06:00');
  const delayMs = Math.max(0, sixAm.getTime() - Date.now());

  for (const v of visits) {
    if (seenCars.has(v.carId)) continue;
    seenCars.add(v.carId);

    const [customer, car, staff] = await Promise.all([
      store.customers.get(v.customerId),
      store.cars.get(v.carId),
      v.staffId ? store.staff.get(v.staffId) : Promise.resolve(null),
    ]);
    if (!customer?.phone || !car) continue;

    const formattedTime = formatTime(v.scheduledTime);
    const portalUrl = `${getAppBaseUrl()}/app`;
    const message = buildSameDayReminderMessage({
      customerName: customer.name,
      carPlate: car.plate,
      scheduledTimeFormatted: formattedTime,
      washboyName: staff?.name,
      portalUrl,
    });

    jobs.push({
      to: customer.phone,
      recipientName: customer.name,
      recipientType: 'CUSTOMER',
      recipientId: customer.id,
      event: 'Today Wash Reminder',
      message,
      dedupKey: `same_day_${v.id}_${v.scheduledDate}`,
      delayMs,
    });
  }

  const batchResult = enqueueWhatsAppBatch(jobs, 'today_wash_reminders');

  return {
    total: visits.length,
    queuedCount: jobs.length,
    batchId: batchResult.batchId,
  };
}

