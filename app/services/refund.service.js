// Refund Service
import { prisma } from "../lib/prisma.js";
import { getCurrentUTC, daysBetween } from "../utilities/dateUtils.js";

class RefundService {
  /**
   * Process a refund for an invoice
   * @param {Object} params - Refund parameters
   * @param {number} params.invoice_id - Invoice ID to refund
   * @param {number} params.amount - Amount to refund (null for full refund)
   * @param {string} params.reason - Reason for refund
   * @param {number} params.processed_by - Admin user ID who processed the refund
   * @returns {Object} Created refund record
   */
  async processRefund({ invoice_id, amount = null, reason, processed_by }) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoice_id },
      include: {
        payments: {
          where: { status: "COMPLETED" },
        },
        refunds: true,
      },
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.status !== "PAID") {
      throw new Error("Can only refund paid invoices");
    }

    const totalPaid = invoice.payments.reduce(
      (sum, payment) => sum + parseFloat(payment.amount),
      0,
    );

    const totalRefunded = invoice.refunds.reduce(
      (sum, refund) => sum + parseFloat(refund.amount),
      0,
    );

    const refundableAmount = totalPaid - totalRefunded;

    if (refundableAmount <= 0) {
      throw new Error("Invoice has already been fully refunded");
    }

    const refundAmount = amount ? parseFloat(amount) : refundableAmount;

    if (refundAmount > refundableAmount) {
      throw new Error(
        `Refund amount (${refundAmount}) exceeds refundable amount (${refundableAmount})`,
      );
    }

    if (refundAmount <= 0) {
      throw new Error("Refund amount must be greater than 0");
    }

    const refund = await prisma.refund.create({
      data: {
        invoice_id,
        payment_id: invoice.payments[0]?.id,
        amount: refundAmount.toFixed(2),
        reason,
        status: "PENDING",
        processed_by,
        processed_at: getCurrentUTC(),
      },
    });

    const isFullRefund = refundAmount === parseFloat(invoice.amount);

    if (isFullRefund) {
      await prisma.invoice.update({
        where: { id: invoice_id },
        data: { status: "REFUNDED" },
      });
    }

    return refund;
  }

  /**
   * Approve a pending refund
   * @param {number} refund_id - Refund ID to approve
   * @returns {Object} Updated refund record
   */
  async approveRefund(refund_id) {
    const refund = await prisma.refund.findUnique({
      where: { id: refund_id },
      include: { invoice: true },
    });

    if (!refund) {
      throw new Error("Refund not found");
    }

    if (refund.status !== "PENDING") {
      throw new Error("Only pending refunds can be approved");
    }

    const updatedRefund = await prisma.refund.update({
      where: { id: refund_id },
      data: {
        status: "COMPLETED",
        refunded_at: getCurrentUTC(),
      },
    });

    return updatedRefund;
  }

  /**
   * Reject a pending refund
   * @param {number} refund_id - Refund ID to reject
   * @param {string} rejection_reason - Reason for rejection
   * @returns {Object} Updated refund record
   */
  async rejectRefund(refund_id, rejection_reason) {
    const refund = await prisma.refund.findUnique({
      where: { id: refund_id },
    });

    if (!refund) {
      throw new Error("Refund not found");
    }

    if (refund.status !== "PENDING") {
      throw new Error("Only pending refunds can be rejected");
    }

    const updatedRefund = await prisma.refund.update({
      where: { id: refund_id },
      data: {
        status: "FAILED",
        reason: `${refund.reason} | Rejected: ${rejection_reason}`,
      },
    });

    return updatedRefund;
  }

  /**
   * Calculate prorated refund amount for subscription cancellation
   * @param {Object} subscription - Subscription object
   * @param {Object} pricing - Pricing object
   * @returns {number} Prorated refund amount
   */
  calculateProratedRefund(subscription, pricing) {
    const now = getCurrentUTC();
    const startDate = new Date(subscription.start_date);
    const endDate = new Date(subscription.end_date);

    const totalDays = daysBetween(startDate, endDate);
    const daysUsed = daysBetween(startDate, now);
    const daysRemaining = daysBetween(now, endDate);

    if (daysRemaining <= 0) {
      return 0;
    }

    const refundAmount =
      (daysRemaining / totalDays) * parseFloat(pricing.price);

    return Math.max(0, parseFloat(refundAmount.toFixed(2)));
  }
}

export default RefundService;
