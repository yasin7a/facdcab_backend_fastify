// Subscription cron job for auto-renewal and expiration checks
import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { queues } from "../queues/queue.js";
import { SubscriptionStatus, InvoiceStatus } from "../utilities/constant.js";
import InvoiceService from "../services/invoice.service.js";
import SubscriptionService from "../services/subscription.service.js";
import { getCurrentUTC } from "../utilities/dateUtils.js";
import { generateInvoiceNumber } from "../utilities/generateInvoiceNumber.js";

const BATCH_SIZE = 100; // Process 100 records at a time

/**
 * Check and expire subscriptions that have passed their end date
 * Dispatches jobs to queue instead of processing directly
 * Uses expiry_processed flag to prevent duplicate processing
 */
export async function checkExpiredSubscriptions() {
  try {
    console.log("[CRON] Checking for expired subscriptions...");

    let lastId = 0;
    let totalDispatched = 0;

    while (true) {
      // Fetch expired subscription IDs in batches using cursor-based pagination
      const expiredSubscriptions = await prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          end_date: { lt: new Date() },
          expiry_processed: false, // Only unprocessed subscriptions
          id: { gt: lastId },
        },
        select: { id: true },
        take: BATCH_SIZE,
        orderBy: { id: "asc" },
      });

      if (expiredSubscriptions.length === 0) break;

      // Mark as being processed to prevent duplicate processing
      const subscriptionIds = expiredSubscriptions.map((sub) => sub.id);
      await prisma.subscription.updateMany({
        where: { id: { in: subscriptionIds } },
        data: { expiry_processed: true },
      });

      // Dispatch to queue
      await queues.subscriptionExpiryQueue.add("expire-batch", {
        subscriptionIds,
      });

      totalDispatched += subscriptionIds.length;
      lastId = expiredSubscriptions[expiredSubscriptions.length - 1].id;

      console.log(
        `[CRON] Dispatched ${subscriptionIds.length} subscriptions to expiry queue`,
      );
    }

    console.log(
      `[CRON] Total ${totalDispatched} expired subscriptions dispatched to queue`,
    );
    return { dispatched: totalDispatched };
  } catch (error) {
    console.error("[CRON] Error checking expired subscriptions:", error);
    throw error;
  }
}

/**
 * Auto-renew subscriptions that are about to expire (within 3 days)
 * Dispatches individual renewal jobs to queue
 * Uses renewal_in_progress flag and last_renewal_attempt to prevent duplicate renewals
 */
export async function autoRenewSubscriptions() {
  try {
    console.log("[CRON] Processing auto-renewal for subscriptions...");

    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Don't retry renewals attempted in last 6 hours
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

    let lastId = 0;
    let totalDispatched = 0;

    while (true) {
      // Find subscriptions ending in next 3 days with auto_renew enabled
      // Exclude those already being processed or recently attempted
      const subscriptionsToRenew = await prisma.subscription.findMany({
        where: {
          auto_renew: true,
          status: SubscriptionStatus.ACTIVE,
          renewal_in_progress: false, // Not currently being renewed
          end_date: {
            lte: threeDaysFromNow,
            gte: now,
          },
          id: { gt: lastId },
          OR: [
            { last_renewal_attempt: null },
            { last_renewal_attempt: { lt: sixHoursAgo } },
          ],
        },
        select: { id: true },
        take: BATCH_SIZE,
        orderBy: { id: "asc" },
      });

      if (subscriptionsToRenew.length === 0) break;

      const subscriptionIds = subscriptionsToRenew.map((sub) => sub.id);

      // Mark as being processed to prevent duplicate renewals
      await prisma.subscription.updateMany({
        where: { id: { in: subscriptionIds } },
        data: {
          renewal_in_progress: true,
          last_renewal_attempt: now,
        },
      });

      // Batch dispatch to renewal queue
      const queuePromises = subscriptionsToRenew.map((subscription) =>
        queues.subscriptionRenewalQueue.add("renew-subscription", {
          subscriptionId: subscription.id,
        }),
      );
      await Promise.all(queuePromises);

      totalDispatched += subscriptionsToRenew.length;
      lastId = subscriptionsToRenew[subscriptionsToRenew.length - 1].id;

      console.log(
        `[CRON] Dispatched ${subscriptionsToRenew.length} subscriptions to renewal queue`,
      );
    }

    console.log(
      `[CRON] Total ${totalDispatched} subscriptions dispatched for renewal`,
    );
    return { dispatched: totalDispatched };
  } catch (error) {
    console.error("[CRON] Error in auto-renewal process:", error);
    throw error;
  }
}

/**
 * Send reminder emails for expiring subscriptions (7 days before)
 */
export async function sendExpiryReminders() {
  try {
    console.log("[CRON] Sending expiry reminders...");

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    let offset = 0;
    let totalReminders = 0;

    while (true) {
      const expiringSubscriptions = await prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          auto_renew: false, // Only for non-auto-renew subscriptions
          end_date: {
            lte: sevenDaysFromNow,
            gte: new Date(),
          },
        },
        select: { id: true },
        take: BATCH_SIZE,
        skip: offset,
      });

      if (expiringSubscriptions.length === 0) break;

      // TODO: Add to email queue when implemented
      // for (const subscription of expiringSubscriptions) {
      //   await queues.emailQueue.add('expiry-reminder', {
      //     subscriptionId: subscription.id
      //   });
      // }

      totalReminders += expiringSubscriptions.length;
      offset += BATCH_SIZE;

      console.log(
        `[CRON] Processed ${expiringSubscriptions.length} expiry reminders`,
      );
    }

    console.log(`[CRON] Total ${totalReminders} expiry reminders queued`);
    return { sent: totalReminders };
  } catch (error) {
    console.error("[CRON] Error sending expiry reminders:", error);
    throw error;
  }
}

/**
 * Retry failed payments (Dunning process)
 * Uses transaction to safely expire subscriptions after max retries
 */
export async function retryFailedPayments() {
  try {
    console.log("[CRON] Processing failed payment retries...");

    const now = new Date();
    let totalRetried = 0;

    // Find failed payments eligible for retry
    const failedPayments = await prisma.payment.findMany({
      where: {
        status: "FAILED",
        metadata: {
          path: ["next_retry_at"],
          not: null,
        },
      },
      include: {
        invoice: {
          include: {
            subscription: true,
          },
        },
      },
      take: 50, // Process 50 at a time
    });

    for (const payment of failedPayments) {
      const nextRetryAt = payment.metadata?.next_retry_at;

      if (!nextRetryAt || new Date(nextRetryAt) > now) {
        continue; // Not ready for retry yet
      }

      const retryAttempts = payment.metadata?.retry_attempts || 0;
      const maxRetries = payment.metadata?.max_retries || 3;

      if (retryAttempts >= maxRetries) {
        // Max retries exceeded - expire subscription if applicable (with transaction)
        if (payment.invoice.subscription_id) {
          await prisma.$transaction(async (tx) => {
            // Check subscription status before expiring
            const subscription = await tx.subscription.findUnique({
              where: { id: payment.invoice.subscription_id },
            });

            // Only expire if still ACTIVE or PENDING
            if (
              subscription &&
              (subscription.status === SubscriptionStatus.ACTIVE ||
                subscription.status === SubscriptionStatus.PENDING)
            ) {
              await tx.subscription.update({
                where: { id: payment.invoice.subscription_id },
                data: { status: SubscriptionStatus.EXPIRED },
              });

              // Mark invoice as FAILED
              await tx.invoice.update({
                where: { id: payment.invoice.id },
                data: { status: "FAILED" },
              });

              console.log(
                `[DUNNING] Subscription ${payment.invoice.subscription_id} expired after ${maxRetries} failed payment attempts`,
              );
            }
          });
        }
        continue;
      }

      // Queue retry to payment queue
      await queues.paymentRetryQueue?.add("retry-payment", {
        payment_id: payment.id,
      });

      totalRetried++;
    }

    console.log(`[CRON] Queued ${totalRetried} failed payments for retry`);
    return { retried: totalRetried };
  } catch (error) {
    console.error("[CRON] Error in payment retry process:", error);
    throw error;
  }
}

/**
 * Convert expired trial subscriptions to paid
 * Generate invoices for trials that have ended
 * Uses transaction to prevent duplicate invoice creation
 */
export async function convertExpiredTrials() {
  try {
    console.log("[CRON] Converting expired trial subscriptions...");

    const now = getCurrentUTC();
    const invoiceService = new InvoiceService();
    const subscriptionService = new SubscriptionService();

    // Find subscriptions with expired trials
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        trial_end: {
          lte: now,
          not: null,
        },
      },
      select: { id: true, user_id: true, tier: true, billing_cycle: true },
    });

    let converted = 0;

    for (const subscription of expiredTrials) {
      try {
        // Get pricing outside transaction
        const pricing = await subscriptionService.getPricing(
          subscription.tier,
          subscription.billing_cycle,
        );

        if (!pricing) {
          console.error(
            `[CRON] Pricing not found for subscription ${subscription.id}`,
          );
          continue;
        }

        // Use transaction to prevent race condition
        await prisma.$transaction(async (tx) => {
          // Check if invoice already exists (with lock)
          const existingInvoice = await tx.invoice.findFirst({
            where: {
              subscription_id: subscription.id,
              status: { in: [InvoiceStatus.PENDING, "COMPLETED"] },
            },
          });

          if (existingInvoice) {
            console.log(
              `[CRON] Invoice already exists for trial subscription ${subscription.id}`,
            );
            return;
          }

          // Generate invoice for first payment after trial
          const invoice_number = generateInvoiceNumber();
          const isFirstSubscription = await invoiceService.isFirstSubscription(
            subscription.user_id,
          );
          const setup_fee = isFirstSubscription
            ? parseFloat(pricing.setup_fee || 0)
            : 0;

          let subtotal = parseFloat(pricing.price) + setup_fee;
          const taxableAmount = subtotal;
          const taxRate = pricing.tax_rate || 0;
          const tax_amount = taxableAmount * taxRate;
          const total_amount = subtotal + tax_amount;

          // Create invoice within transaction
          const invoice = await tx.invoice.create({
            data: {
              invoice_number,
              user_id: subscription.user_id,
              subscription_id: subscription.id,
              purchase_type: "SUBSCRIPTION",
              subtotal: subtotal.toFixed(2),
              tax_amount: tax_amount.toFixed(2),
              discount_amount: "0.00",
              amount: total_amount.toFixed(2),
              currency: pricing.currency,
              status: InvoiceStatus.PENDING,
              due_date: new Date(),
              description: `${subscription.tier} ${subscription.billing_cycle} subscription (post-trial)`,
            },
          });

          // Update subscription to PENDING (awaiting payment)
          await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              status: SubscriptionStatus.PENDING,
            },
          });

          console.log(
            `[CRON] Converted trial subscription ${subscription.id} to paid. Invoice ${invoice.invoice_number} generated.`,
          );
          converted++;
        });
      } catch (error) {
        console.error(
          `[CRON] Error converting trial subscription ${subscription.id}:`,
          error,
        );
      }
    }

    console.log(`[CRON] Converted ${converted} trial subscriptions to paid`);
    return { converted };
  } catch (error) {
    console.error("[CRON] Error converting expired trials:", error);
    throw error;
  }
}

/**
 * Clean up orphaned pending invoices
 * Uses InvoiceService for comprehensive cleanup logic
 */
export async function cleanupPendingInvoices() {
  try {
    console.log("[CRON] Cleaning up orphaned pending invoices...");

    const invoiceService = new InvoiceService();
    const result = await invoiceService.cleanupOrphanedInvoices();

    console.log(`[CRON] Cleaned up ${result.count} orphaned invoices`);
    return result;
  } catch (error) {
    console.error("[CRON] Error cleaning up invoices:", error);
    throw error;
  }
}

/**
 * Clean up orphaned PENDING subscriptions
 * Subscriptions that are PENDING for more than 7 days with no invoice or failed invoices
 */
export async function cleanupOrphanedSubscriptions() {
  try {
    console.log("[CRON] Cleaning up orphaned PENDING subscriptions...");

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find orphaned PENDING subscriptions
    const orphanedSubscriptions = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.PENDING,
        created_at: { lt: sevenDaysAgo },
        OR: [
          // No invoices at all
          { invoices: { none: {} } },
          // All invoices are FAILED
          {
            invoices: {
              every: { status: "FAILED" },
            },
          },
        ],
      },
      include: {
        invoices: true,
      },
    });

    let cleaned = 0;

    for (const subscription of orphanedSubscriptions) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.EXPIRED,
          cancelled_at: new Date(),
        },
      });
      cleaned++;
      console.log(
        `[CRON] Expired orphaned subscription ${subscription.id} (PENDING for >7 days)`,
      );
    }

    console.log(`[CRON] Cleaned up ${cleaned} orphaned subscriptions`);
    return { count: cleaned };
  } catch (error) {
    console.error("[CRON] Error cleaning up orphaned subscriptions:", error);
    throw error;
  }
}

/**
 * Setup and start subscription cron jobs
 */
const subscriptionCronJobs = () => {
  // Run every day at 2:00 AM - Check expired subscriptions
  cron.schedule("0 2 * * *", async () => {
    console.log("🔄 Running subscription expiration check...");
    try {
      await checkExpiredSubscriptions();
    } catch (error) {
      console.error("❌ Subscription expiration check failed:", error);
    }
  });

  // Run every day at 3:00 AM - Auto-renew subscriptions
  cron.schedule("0 3 * * *", async () => {
    console.log("🔄 Running auto-renewal process...");
    try {
      await autoRenewSubscriptions();
    } catch (error) {
      console.error("❌ Auto-renewal process failed:", error);
    }
  });

  // Run every day at 4:00 AM - Send expiry reminders
  cron.schedule("0 4 * * *", async () => {
    console.log("📧 Sending expiry reminders...");
    try {
      await sendExpiryReminders();
    } catch (error) {
      console.error("❌ Expiry reminder process failed:", error);
    }
  });

  // Run every 6 hours - Retry failed payments (Dunning)
  cron.schedule("0 */6 * * *", async () => {
    console.log("🔄 Running payment retry process (Dunning)...");
    try {
      await retryFailedPayments();
    } catch (error) {
      console.error("❌ Payment retry process failed:", error);
    }
  });

  // Run every Sunday at 5:00 AM - Cleanup old pending invoices
  cron.schedule("0 5 * * 0", async () => {
    console.log("🧹 Cleaning up old pending invoices...");
    try {
      await cleanupPendingInvoices();
    } catch (error) {
      console.error("❌ Invoice cleanup failed:", error);
    }
  });

  // Run every Sunday at 6:00 AM - Cleanup orphaned subscriptions
  cron.schedule("0 6 * * 0", async () => {
    console.log("🧹 Cleaning up orphaned subscriptions...");
    try {
      await cleanupOrphanedSubscriptions();
    } catch (error) {
      console.error("❌ Subscription cleanup failed:", error);
    }
  });

  // Run every day at 1:00 AM - Convert expired trials to paid
  cron.schedule("0 1 * * *", async () => {
    console.log("🔄 Converting expired trial subscriptions...");
    try {
      await convertExpiredTrials();
    } catch (error) {
      console.error("❌ Trial conversion failed:", error);
    }
  });

  console.log("✅ Subscription cron jobs scheduled");
};

// Export all cron functions
export default subscriptionCronJobs;
