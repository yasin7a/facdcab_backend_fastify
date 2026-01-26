// Payment Service
import { prisma } from "../lib/prisma.js";
import InvoiceService from "./invoice.service.js";
import EventService from "./event.service.js";
import {
  PaymentStatus,
  SubscriptionStatus,
  RefundStatus,
  StallBookingPurchaseStatus,
  SponsorshipStatus,
} from "../utilities/constant.js";

class PaymentService {
  constructor() {
    this.invoiceService = new InvoiceService();
    this.eventService = new EventService();
  }

  /**
   * Complete payment
   */
  async completePayment(payment_id, transactionData) {
    // Update payment
    const payment = await prisma.payment.update({
      where: { id: payment_id },
      data: {
        status: PaymentStatus.COMPLETED,
        transaction_id:
          transactionData.transaction_id || transactionData.tran_id,
        metadata: {
          bank_tran_id: transactionData.bank_tran_id,
          card_type: transactionData.card_type,
          card_brand: transactionData.card_brand,
          validation_result: transactionData.validationResult,
          completed_at: new Date().toISOString(),
        },
      },
      include: {
        invoice: {
          include: {
            subscription: true,
            stall_booking_purchase: true,
            sponsorship_purchase: true,
          },
        },
      },
    });

    // Mark invoice as paid
    await this.invoiceService.markInvoicePaid(payment.invoice_id);

    // If this is a subscription payment, activate subscription
    if (payment.invoice.subscription_id) {
      await prisma.subscription.update({
        where: { id: payment.invoice.subscription_id },
        data: { status: SubscriptionStatus.ACTIVE },
      });
    }

    // If this is a stall booking payment, confirm booking
    if (payment.invoice.stall_booking_purchase) {
      await this.eventService.confirmStallBooking(
        payment.invoice.stall_booking_purchase.id,
      );
    }

    // If this is a sponsorship payment, confirm purchase
    if (payment.invoice.sponsorship_purchase) {
      await this.eventService.confirmSponsorshipPurchase(
        payment.invoice.sponsorship_purchase.id,
      );
    }

    return payment;
  }

  /**
   * Fail payment with grace period and retry tracking
   */
  async failPayment(payment_id, reason) {
    const payment = await prisma.payment.findUnique({
      where: { id: payment_id },
      include: {
        invoice: {
          include: { subscription: true },
        },
      },
    });

    if (!payment) {
      throw new Error(`Payment ${payment_id} not found`);
    }

    const currentRetries = payment.metadata?.retry_attempts || 0;
    const maxRetries = 3;
    const gracePeriodDays = 7;

    // Update payment with failure info
    const updatedPayment = await prisma.payment.update({
      where: { id: payment_id },
      data: {
        status: PaymentStatus.FAILED,
        metadata: {
          ...payment.metadata,
          failure_reason: reason,
          failed_at: new Date().toISOString(),
          retry_attempts: currentRetries,
          max_retries: maxRetries,
          next_retry_at:
            currentRetries < maxRetries
              ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Retry in 24 hours
              : null,
        },
      },
    });

    // If this is a subscription payment, start grace period
    if (payment.invoice.subscription_id && currentRetries === 0) {
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);

      await prisma.subscription.update({
        where: { id: payment.invoice.subscription_id },
        data: {
          // Keep subscription ACTIVE during grace period
          // Store grace period info in end_date temporarily or use metadata
          // For simplicity, we'll extend end_date by grace period
          end_date: gracePeriodEnd,
        },
      });

      console.log(
        `[GRACE] Subscription ${payment.invoice.subscription_id} entered grace period until ${gracePeriodEnd.toISOString()}`,
      );
    }

    return updatedPayment;
  }

  /**
   * Process refund
   */
  async processRefund(refund_id, sslcommerzResponse) {
    const refund = await prisma.refund.update({
      where: { id: refund_id },
      data: {
        status: RefundStatus.COMPLETED,
      },
      include: { invoice: true },
    });

    // Mark invoice as refunded
    await this.invoiceService.markInvoiceRefunded(refund.invoice_id);

    // Update payment status
    await prisma.payment.updateMany({
      where: { invoice_id: refund.invoice_id },
      data: { status: PaymentStatus.REFUNDED },
    });

    // If subscription payment, cancel subscription
    if (refund.invoice.subscription_id) {
      await prisma.subscription.update({
        where: { id: refund.invoice.subscription_id },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelled_at: new Date(),
        },
      });
    }

    return refund;
  }

  /**
   * Get payment statistics for user
   */
  async getUserPaymentStats(user_id) {
    const [totalPayments, totalAmount, completedPayments] = await Promise.all([
      prisma.payment.count({ where: { user_id } }),
      prisma.payment.aggregate({
        where: { user_id, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      }),
      prisma.payment.count({
        where: { user_id, status: PaymentStatus.COMPLETED },
      }),
    ]);

    return {
      total_payments: totalPayments,
      total_amount_paid: totalAmount._sum.amount || 0,
      completed_payments: completedPayments,
    };
  }

  /**
   * Retry failed payment (Dunning process)
   */
  async retryFailedPayment(payment_id) {
    const payment = await prisma.payment.findUnique({
      where: { id: payment_id },
      include: {
        invoice: { include: { subscription: true, user: true } },
      },
    });

    if (!payment) {
      throw new Error(`Payment ${payment_id} not found`);
    }

    if (payment.status !== PaymentStatus.FAILED) {
      throw new Error(`Payment ${payment_id} is not failed`);
    }

    const retryAttempts = (payment.metadata?.retry_attempts || 0) + 1;
    const maxRetries = payment.metadata?.max_retries || 3;

    if (retryAttempts > maxRetries) {
      console.log(
        `[DUNNING] Payment ${payment_id} exceeded max retries (${maxRetries})`,
      );
      return null;
    }

    // Update retry count
    await prisma.payment.update({
      where: { id: payment_id },
      data: {
        status: PaymentStatus.PENDING,
        metadata: {
          ...payment.metadata,
          retry_attempts: retryAttempts,
          retry_at: new Date().toISOString(),
          next_retry_at:
            retryAttempts < maxRetries
              ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // Next retry in 48 hours
              : null,
        },
      },
    });

    console.log(
      `[DUNNING] Retry attempt ${retryAttempts}/${maxRetries} for payment ${payment_id}`,
    );

    // TODO: Integrate with payment gateway to retry charge
    // For now, we just mark it as pending and return payment info
    // In real implementation, call SSLCommerz or your payment provider here

    return {
      payment_id,
      retry_attempt: retryAttempts,
      max_retries: maxRetries,
      user_email: payment.invoice.user.email,
      amount: payment.amount,
      invoice_id: payment.invoice_id,
    };
  }
}

export default PaymentService;
