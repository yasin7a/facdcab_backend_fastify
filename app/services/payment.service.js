// Payment Service
import { prisma } from "../lib/prisma.js";
import InvoiceService from "./invoice.service.js";
import {
  PaymentStatus,
  SubscriptionStatus,
  RefundStatus,
} from "../utilities/constant.js";

class PaymentService {
  constructor() {
    this.invoiceService = new InvoiceService();
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
      include: { invoice: { include: { subscription: true } } },
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

    return payment;
  }

  /**
   * Fail payment
   */
  async failPayment(payment_id, reason) {
    return await prisma.payment.update({
      where: { id: payment_id },
      data: {
        status: PaymentStatus.FAILED,
        metadata: {
          failure_reason: reason,
          failed_at: new Date().toISOString(),
        },
      },
    });
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
}

export default PaymentService;
