// Subscription cron job for auto-renewal and expiration checks
import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { queues } from "../queues/queue.js";
import { SubscriptionStatus, InvoiceStatus } from "../utilities/constant.js";

const BATCH_SIZE = 100; // Process 100 records at a time

/**
 * Check and expire subscriptions that have passed their end date
 * Dispatches jobs to queue instead of processing directly
 */
export async function checkExpiredSubscriptions() {
  try {
    console.log("[CRON] Checking for expired subscriptions...");

    let offset = 0;
    let totalDispatched = 0;

    while (true) {
      // Fetch expired subscription IDs in batches
      const expiredSubscriptions = await prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          end_date: { lt: new Date() },
        },
        select: { id: true },
        take: BATCH_SIZE,
        skip: offset,
      });

      if (expiredSubscriptions.length === 0) break;

      // Dispatch to queue
      const subscriptionIds = expiredSubscriptions.map((sub) => sub.id);
      await queues.subscriptionExpiryQueue.add("expire-batch", {
        subscriptionIds,
      });

      totalDispatched += subscriptionIds.length;
      offset += BATCH_SIZE;

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
 */
export async function autoRenewSubscriptions() {
  try {
    console.log("[CRON] Processing auto-renewal for subscriptions...");

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    let offset = 0;
    let totalDispatched = 0;

    while (true) {
      // Find subscriptions ending in next 3 days with auto_renew enabled
      const subscriptionsToRenew = await prisma.subscription.findMany({
        where: {
          auto_renew: true,
          status: SubscriptionStatus.ACTIVE,
          end_date: {
            lte: threeDaysFromNow,
            gte: new Date(),
          },
        },
        select: { id: true },
        take: BATCH_SIZE,
        skip: offset,
      });

      if (subscriptionsToRenew.length === 0) break;

      // Dispatch each subscription to renewal queue
      for (const subscription of subscriptionsToRenew) {
        await queues.subscriptionRenewalQueue.add("renew-subscription", {
          subscriptionId: subscription.id,
        });
      }

      totalDispatched += subscriptionsToRenew.length;
      offset += BATCH_SIZE;

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
 * Clean up old pending invoices (older than 7 days)
 */
export async function cleanupPendingInvoices() {
  try {
    console.log("[CRON] Cleaning up old pending invoices...");

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await prisma.invoice.updateMany({
      where: {
        status: InvoiceStatus.PENDING,
        created_at: {
          lt: sevenDaysAgo,
        },
      },
      data: {
        status: InvoiceStatus.CANCELLED,
        notes: "Auto-cancelled - Payment not completed within 7 days",
      },
    });

    console.log(`[CRON] Cleaned up ${result.count} old pending invoices`);
    return result;
  } catch (error) {
    console.error("[CRON] Error cleaning up invoices:", error);
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

  // Run every Sunday at 5:00 AM - Cleanup old pending invoices
  cron.schedule("0 5 * * 0", async () => {
    console.log("🧹 Cleaning up old pending invoices...");
    try {
      await cleanupPendingInvoices();
    } catch (error) {
      console.error("❌ Invoice cleanup failed:", error);
    }
  });

  console.log("✅ Subscription cron jobs scheduled");
};

// Export all cron functions
export default subscriptionCronJobs;
