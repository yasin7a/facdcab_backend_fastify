// Payment Retry Service (Dunning Management)
import { prisma } from "../lib/prisma.js";
import { addDays, getCurrentUTC } from "../utilities/dateUtils.js";

class PaymentRetryService {
  /**
   * Schedule a payment retry
   * @param {number} payment_id - Payment ID to retry
   * @param {number} attempt_number - Current attempt number (1-based)
   * @returns {Object} Updated payment with retry metadata
   */
  async scheduleRetry(payment_id, attempt_number = 1) {
    const payment = await prisma.payment.findUnique({
      where: { id: payment_id },
      include: { invoice: true },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== "FAILED") {
      throw new Error("Can only retry failed payments");
    }

    const maxRetries = 3;
    const retryDelays = [3, 5, 7]; // Days to wait before each retry

    if (attempt_number > maxRetries) {
      return await this.markPaymentAsPermanentlyFailed(payment_id);
    }

    const nextRetryDate = addDays(
      getCurrentUTC(),
      retryDelays[attempt_number - 1] || 7,
    );

    const updatedPayment = await prisma.payment.update({
      where: { id: payment_id },
      data: {
        metadata: {
          ...payment.metadata,
          retry_attempts: attempt_number,
          max_retries: maxRetries,
          next_retry_at: nextRetryDate.toISOString(),
          last_retry_at: getCurrentUTC().toISOString(),
        },
      },
    });

    console.log(
      `[PaymentRetry] Scheduled retry ${attempt_number}/${maxRetries} for payment ${payment_id} at ${nextRetryDate}`,
    );

    return updatedPayment;
  }

  /**
   * Process a payment retry attempt
   * @param {number} payment_id - Payment ID to retry
   * @returns {Object} Result of retry attempt
   */
  async processRetry(payment_id) {
    const payment = await prisma.payment.findUnique({
      where: { id: payment_id },
      include: {
        invoice: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    const retryAttempts = payment.metadata?.retry_attempts || 0;
    const maxRetries = payment.metadata?.max_retries || 3;

    if (retryAttempts >= maxRetries) {
      return await this.markPaymentAsPermanentlyFailed(payment_id);
    }

    console.log(
      `[PaymentRetry] Processing retry attempt ${retryAttempts + 1}/${maxRetries} for payment ${payment_id}`,
    );

    return {
      payment_id,
      attempt: retryAttempts + 1,
      max_retries: maxRetries,
      status: "RETRY_SCHEDULED",
      message: "Payment retry will be processed by payment gateway",
    };
  }

  /**
   * Mark payment as permanently failed after max retries
   * @param {number} payment_id - Payment ID
   * @returns {Object} Updated payment
   */
  async markPaymentAsPermanentlyFailed(payment_id) {
    const payment = await prisma.payment.findUnique({
      where: { id: payment_id },
      include: {
        invoice: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: payment_id },
      data: {
        status: "FAILED",
        metadata: {
          ...payment.metadata,
          permanently_failed: true,
          failed_at: getCurrentUTC().toISOString(),
        },
      },
    });

    await prisma.invoice.update({
      where: { id: payment.invoice_id },
      data: {
        status: "FAILED",
        notes: "Payment permanently failed after maximum retry attempts",
      },
    });

    if (payment.invoice.subscription_id) {
      await prisma.subscription.update({
        where: { id: payment.invoice.subscription_id },
        data: {
          status: "EXPIRED",
        },
      });
    }

    console.log(
      `[PaymentRetry] Payment ${payment_id} marked as permanently failed`,
    );

    return updatedPayment;
  }

  /**
   * Get payments eligible for retry
   * @returns {Array} List of payments ready for retry
   */
  async getPaymentsForRetry() {
    const now = getCurrentUTC();

    const payments = await prisma.payment.findMany({
      where: {
        status: "FAILED",
      },
      include: {
        invoice: {
          include: {
            subscription: true,
          },
        },
      },
    });

    const eligiblePayments = payments.filter((payment) => {
      const nextRetryAt = payment.metadata?.next_retry_at;
      const retryAttempts = payment.metadata?.retry_attempts || 0;
      const maxRetries = payment.metadata?.max_retries || 3;
      const permanentlyFailed = payment.metadata?.permanently_failed || false;

      if (permanentlyFailed || retryAttempts >= maxRetries) {
        return false;
      }

      if (!nextRetryAt) {
        return true;
      }

      return new Date(nextRetryAt) <= now;
    });

    return eligiblePayments;
  }

  /**
   * Send reminder notification for failed payment
   * Placeholder for email integration
   * @param {number} payment_id - Payment ID
   * @param {number} attempt_number - Retry attempt number
   */
  async sendRetryReminder(payment_id, attempt_number) {
    console.log(
      `[PaymentRetry] TODO: Send email reminder for payment ${payment_id}, attempt ${attempt_number}`,
    );

    return {
      sent: false,
      message: "Email integration not yet implemented",
    };
  }
}

export default PaymentRetryService;
