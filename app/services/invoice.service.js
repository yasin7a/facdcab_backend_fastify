// Invoice Service
import { prisma } from "../lib/prisma.js";
import { generateInvoiceNumber } from "../utilities/generateInvoiceNumber.js";
import { SubscriptionStatus } from "../utilities/constant.js";
import serverConfig from "../../config/server.config.js";

class InvoiceService {
  /**
   * Generate invoice for subscription
   */
  async generateSubscriptionInvoice({
    user_id,
    subscription_id,
    tier,
    billing_cycle,
    pricing,
    coupon_code = null,
  }) {
    const invoice_number = generateInvoiceNumber();

    // Check if this is the first subscription for the user
    const isFirstSubscription = await this.isFirstSubscription(user_id);
    const setup_fee = isFirstSubscription
      ? parseFloat(pricing.setup_fee || 0)
      : 0;

    // Calculate amounts
    let subtotal = parseFloat(pricing.price) + setup_fee;
    let tax_amount = 0;
    let discount_amount = 0;

    // Apply coupon if provided
    if (coupon_code) {
      const coupon = await this.validateCoupon(coupon_code, user_id, {
        purchase_type: "SUBSCRIPTION",
        tier,
        billing_cycle,
        subtotal,
      });

      if (coupon) {
        discount_amount = this.calculateDiscount(coupon, subtotal);
      }
    }

    // Calculate tax (configurable, default 0%)
    const taxableAmount = subtotal - discount_amount;
    const taxRate = pricing.tax_rate || 0; // Default to 0% tax
    tax_amount = taxableAmount * taxRate;

    const total_amount = subtotal - discount_amount + tax_amount;

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoice_number,
        user_id,
        subscription_id,
        purchase_type: "SUBSCRIPTION",
        subtotal: subtotal.toFixed(2),
        tax_amount: tax_amount.toFixed(2),
        discount_amount: discount_amount.toFixed(2),
        amount: total_amount.toFixed(2),
        currency: pricing.currency,
        status: "PENDING",
        due_date: new Date(),
        coupon_code,
        description: `${tier} ${billing_cycle} subscription`,
      },
    });

    // Create invoice items
    // Add setup fee item if applicable
    if (setup_fee > 0) {
      await prisma.invoiceItem.create({
        data: {
          invoice_id: invoice.id,
          name: `${tier} Setup Fee`,
          description: `One-time setup fee for ${tier} subscription`,
          quantity: 1,
          unit_price: setup_fee.toFixed(2),
          total_price: setup_fee.toFixed(2),
          metadata: {
            type: "setup_fee",
            tier,
          },
        },
      });
    }

    // Create recurring subscription item
    await prisma.invoiceItem.create({
      data: {
        invoice_id: invoice.id,
        name: `${tier} ${billing_cycle} Plan`,
        description: `Subscription to ${tier} tier`,
        quantity: 1,
        unit_price: parseFloat(pricing.price).toFixed(2),
        total_price: parseFloat(pricing.price).toFixed(2),
        metadata: {
          type: "recurring",
          tier,
          billing_cycle,
        },
      },
    });

    return invoice;
  }

  /**
   * Check if this is the user's first subscription
   */
  async isFirstSubscription(user_id) {
    const count = await prisma.subscription.count({
      where: {
        user_id,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.EXPIRED,
            SubscriptionStatus.CANCELLED,
            SubscriptionStatus.PENDING,
          ],
        },
      },
    });
    return count === 0;
  }

  /**
   * Generate invoice for product/service purchase
   */
  async generatePurchaseInvoice({
    user_id,
    purchase_type,
    items,
    coupon_code = null,
    billing_address = null,
  }) {
    const invoice_number = generateInvoiceNumber();

    // Calculate subtotal
    let subtotal = items.reduce((sum, item) => {
      return sum + parseFloat(item.unit_price) * item.quantity;
    }, 0);

    let discount_amount = 0;

    // Apply coupon if provided
    if (coupon_code) {
      const coupon = await this.validateCoupon(coupon_code, user_id, {
        purchase_type,
        subtotal,
      });

      if (coupon) {
        discount_amount = this.calculateDiscount(coupon, subtotal);
      }
    }

    // Calculate tax (configurable, default 0%)
    const taxableAmount = subtotal - discount_amount;
    const taxRate = 0; // Default to 0% tax, can be configured per region
    const tax_amount = taxableAmount * taxRate;

    const total_amount = subtotal - discount_amount + tax_amount;

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoice_number,
        user_id,
        purchase_type,
        subtotal: subtotal.toFixed(2),
        tax_amount: tax_amount.toFixed(2),
        discount_amount: discount_amount.toFixed(2),
        amount: total_amount.toFixed(2),
        currency: serverConfig.CURRENCY,
        status: "PENDING",
        due_date: new Date(),
        coupon_code,
        billing_address,
      },
    });

    // Create invoice items
    for (const item of items) {
      const total_price = parseFloat(item.unit_price) * item.quantity;
      await prisma.invoiceItem.create({
        data: {
          invoice_id: invoice.id,
          name: item.name,
          description: item.description || null,
          quantity: item.quantity,
          unit_price: parseFloat(item.unit_price).toFixed(2),
          total_price: total_price.toFixed(2),
          metadata: item.metadata || null,
        },
      });
    }

    return invoice;
  }

  /**
   * Validate coupon code
   */
  async validateCoupon(code, user_id, invoiceData) {
    const coupon = await prisma.coupon.findUnique({
      where: { code },
    });

    if (!coupon || !coupon.is_active) {
      return null;
    }

    // Check expiry
    if (coupon.valid_until && new Date() > new Date(coupon.valid_until)) {
      return null;
    }

    // Check max uses
    if (coupon.max_uses) {
      const totalUses = await prisma.invoice.count({
        where: { coupon_code: code },
      });
      if (totalUses >= coupon.max_uses) {
        return null;
      }
    }

    // Check per-user usage
    if (coupon.max_uses_per_user) {
      const userUses = await prisma.invoice.count({
        where: { user_id, coupon_code: code },
      });
      if (userUses >= coupon.max_uses_per_user) {
        return null;
      }
    }

    // Check minimum purchase
    if (
      coupon.min_purchase_amount &&
      parseFloat(invoiceData.subtotal) < parseFloat(coupon.min_purchase_amount)
    ) {
      return null;
    }

    // Check purchase type restriction
    if (
      coupon.purchase_types &&
      !coupon.purchase_types.includes(invoiceData.purchase_type)
    ) {
      return null;
    }

    // Check tier restriction (for subscriptions)
    if (coupon.applicable_tiers && invoiceData.tier) {
      if (!coupon.applicable_tiers.includes(invoiceData.tier)) {
        return null;
      }
    }

    // Check billing cycle restriction
    if (coupon.applicable_cycles && invoiceData.billing_cycle) {
      if (!coupon.applicable_cycles.includes(invoiceData.billing_cycle)) {
        return null;
      }
    }

    return coupon;
  }

  /**
   * Calculate discount based on coupon type
   */
  calculateDiscount(coupon, subtotal) {
    let discount = 0;

    if (coupon.type === "PERCENTAGE") {
      discount = (subtotal * parseFloat(coupon.discount_value)) / 100;
    } else if (coupon.type === "FIXED") {
      discount = parseFloat(coupon.discount_value);
    } else if (coupon.type === "FREE_TRIAL") {
      discount = subtotal; // 100% off
    }

    // Discount cannot exceed subtotal
    return Math.min(discount, subtotal);
  }

  /**
   * Mark invoice as paid
   */
  async markInvoicePaid(invoice_id) {
    return await prisma.invoice.update({
      where: { id: invoice_id },
      data: {
        status: "COMPLETED",
        paid_date: new Date(),
      },
    });
  }

  /**
   * Mark invoice as refunded
   */
  async markInvoiceRefunded(invoice_id) {
    return await prisma.invoice.update({
      where: { id: invoice_id },
      data: {
        status: "REFUNDED",
      },
    });
  }
}

export default InvoiceService;
