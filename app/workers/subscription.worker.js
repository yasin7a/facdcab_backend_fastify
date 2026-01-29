// Subscription workers for background processing
import { prisma } from "../lib/prisma.js";
import SubscriptionService from "../services/subscription.service.js";
import InvoiceService from "../services/invoice.service.js";
import { startWorker } from "./base.worker.js";
import { SubscriptionStatus, InvoiceStatus } from "../utilities/constant.js";

const subscriptionService = new SubscriptionService();
const invoiceService = new InvoiceService();

/**
 * Process subscription renewal
 * Resets renewal_in_progress flag after completion or failure
 */
async function processRenewal(job) {
  const { subscriptionId } = job.data;

  try {
    console.log(
      `[WORKER] Processing renewal for subscription ${subscriptionId}`,
    );

    // Use transaction for data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get subscription with lock
      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: { user: true },
      });

      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        console.log(
          `[WORKER] Subscription ${subscriptionId} is not active, skipping`,
        );
        // Reset flag even if not active
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: { renewal_in_progress: false },
        });
        return null;
      }

      // Check if invoice already created
      const existingInvoice = await tx.invoice.findFirst({
        where: {
          subscription_id: subscription.id,
          status: InvoiceStatus.PENDING,
          created_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      if (existingInvoice) {
        console.log(
          `[WORKER] Invoice already exists for subscription ${subscriptionId}`,
        );
        // Reset flag since renewal already processed
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: { renewal_in_progress: false },
        });
        return existingInvoice;
      }

      // Get pricing
      const pricing = await subscriptionService.getPricing(
        subscription.tier,
        subscription.billing_cycle,
      );

      if (!pricing) {
        throw new Error(
          `Pricing not found for ${subscription.tier} ${subscription.billing_cycle}`,
        );
      }

      // Generate renewal invoice
      const invoice = await tx.invoice.create({
        data: {
          user_id: subscription.user_id,
          subscription_id: subscription.id,
          invoice_number: await invoiceService.generateInvoiceNumber(),
          amount: pricing.price,
          currency: pricing.currency,
          status: InvoiceStatus.PENDING,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          items: {
            create: [
              {
                description: `${subscription.tier} Plan - ${subscription.billing_cycle} Renewal`,
                quantity: 1,
                unit_price: pricing.price,
                total_price: pricing.price,
              },
            ],
          },
        },
      });

      // Reset renewal flag after successful invoice creation
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { renewal_in_progress: false },
      });

      console.log(
        `[WORKER] Created renewal invoice ${invoice.invoice_number} for subscription ${subscriptionId}`,
      );

      return invoice;
    });

    return result;
  } catch (error) {
    console.error(
      `[WORKER] Error processing renewal for subscription ${subscriptionId}:`,
      error,
    );

    // Reset flag on error to prevent stuck locks
    try {
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { renewal_in_progress: false },
      });
    } catch (resetError) {
      console.error(
        `[WORKER] Failed to reset renewal flag for subscription ${subscriptionId}:`,
        resetError,
      );
    }

    throw error;
  }
}

/**
 * Process subscription expiration
 */
async function processExpiration(job) {
  const { subscriptionIds } = job.data;

  try {
    console.log(
      `[WORKER] Processing expiration for ${subscriptionIds.length} subscriptions`,
    );

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.updateMany({
        where: {
          id: { in: subscriptionIds },
          status: SubscriptionStatus.ACTIVE,
          end_date: { lt: new Date() },
        },
        data: {
          status: SubscriptionStatus.EXPIRED,
        },
      });

      return updated.count;
    });

    console.log(`[WORKER] Expired ${result} subscriptions`);
    return result;
  } catch (error) {
    console.error(`[WORKER] Error processing expirations:`, error);
    throw error;
  }
}

/**
 * Start renewal worker
 */
function startRenewalWorker() {
  return startWorker("subscription-renewal-queue", processRenewal);
}

/**
 * Start expiry worker
 */
function startExpiryWorker() {
  return startWorker("subscription-expiry-queue", processExpiration);
}

export { startRenewalWorker, startExpiryWorker };
