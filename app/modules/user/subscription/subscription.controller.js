// Subscription module controllers
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import verifyAuth from "../../../middleware/verifyAuth.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { schemas } from "../../../validators/validations.js";
import SubscriptionService from "../../../services/subscription.service.js";
import InvoiceService from "../../../services/invoice.service.js";
import { SubscriptionStatus } from "../../../utilities/constant.js";
import { generateInvoiceNumber } from "../../../utilities/generateInvoiceNumber.js";
import { addDays } from "../../../utilities/dateUtils.js";

async function subscriptionController(fastify, options) {
  const subscriptionService = new SubscriptionService();
  const invoiceService = new InvoiceService();

  // Create subscription
  fastify.post(
    "/create",
    {
      preHandler: [
        verifyAuth,
        validate(schemas.subscription.createSubscription),
      ],
    },
    async (request, reply) => {
      const { tier, billing_cycle, coupon_code, idempotency_key, trial_days } =
        request.body;
      const user_id = request.auth_id;

      // Check idempotency key to prevent duplicate requests
      if (idempotency_key) {
        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            idempotency_key,
            user_id,
          },
          include: {
            subscription: true,
          },
        });

        if (existingInvoice) {
          return sendResponse(
            reply,
            httpStatus.OK,
            "Subscription already created (idempotent)",
            {
              subscription: existingInvoice.subscription,
              invoice: existingInvoice,
            },
          );
        }
      }

      // Get pricing first (outside transaction)
      const pricing = await subscriptionService.getPricing(tier, billing_cycle);

      if (!pricing) {
        throw throwError(
          httpStatus.NOT_FOUND,
          "Pricing not found for this plan",
        );
      }

      // Calculate dates
      const dates = subscriptionService.calculateDates(billing_cycle);

      // Calculate trial end date if trial_days provided
      let trial_end = null;
      if (trial_days && trial_days > 0) {
        trial_end = addDays(dates.startDate, trial_days);
      }

      // Use transaction to prevent race condition
      const result = await prisma.$transaction(async (tx) => {
        // Check if user already has an active or pending subscription (with lock)
        const existingSubscription = await tx.subscription.findFirst({
          where: {
            user_id,
            status: {
              in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING],
            },
          },
        });

        if (existingSubscription) {
          throw throwError(
            httpStatus.BAD_REQUEST,
            "You already have an active or pending subscription. Please cancel it first or wait for it to expire.",
          );
        }

        // Create subscription
        const subscription = await tx.subscription.create({
          data: {
            user_id,
            tier,
            billing_cycle,
            status: trial_days
              ? SubscriptionStatus.ACTIVE
              : SubscriptionStatus.PENDING,
            start_date: dates.startDate,
            end_date: dates.endDate,
            auto_renew: dates.autoRenew,
            trial_end,
          },
        });

        // Generate invoice only if NOT in trial period
        let invoiceData = null;
        if (!trial_days || trial_days <= 0) {
          const invoice_number = generateInvoiceNumber();
          const isFirstSubscription =
            await invoiceService.isFirstSubscription(user_id);
          const setup_fee = isFirstSubscription
            ? parseFloat(pricing.setup_fee || 0)
            : 0;

          let subtotal = parseFloat(pricing.price) + setup_fee;
          let tax_amount = 0;
          let discount_amount = 0;

          // Apply coupon if provided
          if (coupon_code) {
            const coupon = await invoiceService.validateCoupon(
              coupon_code,
              user_id,
              {
                purchase_type: "SUBSCRIPTION",
                tier,
                billing_cycle,
                subtotal,
              },
            );

            if (coupon) {
              discount_amount = invoiceService.calculateDiscount(
                coupon,
                subtotal,
              );
            }
          }

          const taxableAmount = subtotal - discount_amount;
          const taxRate = pricing.tax_rate || 0;
          tax_amount = taxableAmount * taxRate;
          const total_amount = subtotal - discount_amount + tax_amount;

          // Create invoice within transaction
          invoiceData = await tx.invoice.create({
            data: {
              invoice_number,
              user_id,
              subscription_id: subscription.id,
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
              idempotency_key,
            },
          });
        }

        return { subscription, invoiceData };
      });

      const { subscription, invoiceData } = result;

      return sendResponse(reply, httpStatus.CREATED, "Subscription created", {
        subscription,
        invoice: invoiceData,
        message: trial_days
          ? `Trial period active for ${trial_days} days. Payment will be required after trial ends.`
          : "Invoice generated. Please complete payment.",
      });
    },
  );

  // Get user subscriptions
  fastify.get(
    "/my-subscriptions",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const user_id = request.auth_id;

      const subscriptions = await prisma.subscription.findMany({
        where: { user_id },
        include: {
          invoices: {
            include: {
              payments: true,
            },
            orderBy: { created_at: "desc" },
          },
        },
        orderBy: { created_at: "desc" },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Subscriptions retrieved",
        subscriptions,
      );
    },
  );

  // Get subscription with features
  fastify.get(
    "/features/:id",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { id } = request.params;
      const user_id = request.auth_id;

      const subscription = await prisma.subscription.findFirst({
        where: { id: parseInt(id), user_id },
      });

      if (!subscription) {
        throw throwError(httpStatus.NOT_FOUND, "Subscription not found");
      }

      const features = await subscriptionService.getSubscriptionFeatures(
        subscription.tier,
      );

      return sendResponse(reply, httpStatus.OK, "Features retrieved", {
        subscription,
        features,
      });
    },
  );

  // Cancel subscription
  fastify.put(
    "/cancel/:id",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { id } = request.params;
      const user_id = request.auth_id;

      const subscription = await prisma.subscription.findFirst({
        where: { id: parseInt(id), user_id },
      });

      if (!subscription) {
        throw throwError(httpStatus.NOT_FOUND, "Subscription not found");
      }

      if (subscription.status === "CANCELLED") {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Subscription is already cancelled",
        );
      }

      // Refund calculation (commented out - not needed)
      // const pricing = await subscriptionService.getPricing(
      //   subscription.tier,
      //   subscription.billing_cycle
      // );
      // const RefundService = (await import("../../../services/refund.service.js")).default;
      // const refundService = new RefundService();
      // const refundAmount = refundService.calculateProratedRefund(subscription, pricing);

      const updatedSubscription = await prisma.subscription.update({
        where: { id: parseInt(id) },
        data: {
          status: "CANCELLED",
          cancelled_at: new Date(),
          auto_renew: false,
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Subscription cancelled ",
        updatedSubscription,
      );
    },
  );

  // Reactivate subscription
  fastify.put(
    "/reactivate/:id",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { id } = request.params;
      const user_id = request.auth_id;

      const subscription = await prisma.subscription.findFirst({
        where: { id: parseInt(id), user_id },
      });

      if (!subscription) {
        throw throwError(httpStatus.NOT_FOUND, "Subscription not found");
      }

      if (subscription.status === SubscriptionStatus.ACTIVE) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Subscription is already active",
        );
      }

      if (subscription.status === SubscriptionStatus.PENDING) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Subscription is pending payment. Please complete the payment first.",
        );
      }

      if (
        subscription.status !== SubscriptionStatus.CANCELLED &&
        subscription.status !== SubscriptionStatus.EXPIRED
      ) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Only cancelled or expired subscriptions can be reactivated",
        );
      }

      // Get pricing
      const pricing = await subscriptionService.getPricing(
        subscription.tier,
        subscription.billing_cycle,
      );

      if (!pricing) {
        throw throwError(
          httpStatus.NOT_FOUND,
          "Pricing not found for this plan",
        );
      }

      // Calculate new dates
      const dates = subscriptionService.calculateDates(
        subscription.billing_cycle,
      );

      // Update subscription to PENDING (awaiting payment)
      const reactivatedSubscription = await prisma.subscription.update({
        where: { id: parseInt(id) },
        data: {
          status: SubscriptionStatus.PENDING,
          start_date: dates.startDate,
          end_date: dates.endDate,
          auto_renew: dates.autoRenew,
          cancelled_at: null,
        },
      });

      // Generate invoice for reactivation (no setup fee for returning customers)
      const invoiceData = await invoiceService.generateSubscriptionInvoice({
        user_id,
        subscription_id: subscription.id,
        tier: subscription.tier,
        billing_cycle: subscription.billing_cycle,
        pricing,
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Subscription reactivated. Please complete the payment.",
        {
          subscription: reactivatedSubscription,
          invoice: invoiceData,
        },
      );
    },
  );

  // Upgrade/Downgrade subscription
  fastify.put(
    "/change-plan/:id",
    {
      preHandler: [
        verifyAuth,
        validate(schemas.subscription.createSubscription),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tier, billing_cycle } = request.body;
      const user_id = request.auth_id;

      // Get current subscription
      const subscription = await prisma.subscription.findFirst({
        where: { id: parseInt(id), user_id },
      });

      if (!subscription) {
        throw throwError(httpStatus.NOT_FOUND, "Subscription not found");
      }

      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Only active subscriptions can be changed. Current status: " +
            subscription.status,
        );
      }

      // Check if same plan
      if (
        subscription.tier === tier &&
        subscription.billing_cycle === billing_cycle
      ) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "You are already on this plan",
        );
      }

      // Validate billing cycle changes
      const billingCycleOrder = {
        MONTHLY: 1,
        SIX_MONTHLY: 2,
        YEARLY: 3,
        LIFETIME: 4,
      };
      const currentCycleValue =
        billingCycleOrder[subscription.billing_cycle] || 0;
      const newCycleValue = billingCycleOrder[billing_cycle] || 0;

      if (newCycleValue < currentCycleValue) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          `Cannot downgrade billing cycle from ${subscription.billing_cycle} to ${billing_cycle}. Please wait until your current subscription ends or contact support.`,
        );
      }

      // Get current pricing
      const currentPricing = await subscriptionService.getPricing(
        subscription.tier,
        subscription.billing_cycle,
      );

      // Get new pricing
      const newPricing = await subscriptionService.getPricing(
        tier,
        billing_cycle,
      );

      if (!currentPricing || !newPricing) {
        throw throwError(httpStatus.NOT_FOUND, "Pricing not found");
      }

      // Determine if upgrade or downgrade
      const tierOrder = { GOLD: 1, PLATINUM: 2, DIAMOND: 3 };
      const currentTierValue = tierOrder[subscription.tier] || 0;
      const newTierValue = tierOrder[tier] || 0;
      const isUpgrade = newTierValue > currentTierValue;
      const isDowngrade = newTierValue < currentTierValue;

      // Downgrade protection: Schedule for next billing cycle
      if (isDowngrade) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          `Downgrades from ${subscription.tier} to ${tier} are scheduled for the next billing cycle. Please contact support to schedule a downgrade.`,
        );
      }

      // Calculate proration (only for upgrades)
      const proration = subscriptionService.calculateProration(
        subscription,
        currentPricing,
        newPricing,
      );

      // Update subscription
      const updatedSubscription = await prisma.subscription.update({
        where: { id: parseInt(id) },
        data: {
          tier,
          billing_cycle,
          // Keep same end_date (user gets upgraded for remaining time)
        },
      });

      // Generate prorated invoice
      const invoice_number = generateInvoiceNumber();

      const invoice = await prisma.invoice.create({
        data: {
          invoice_number,
          user_id,
          subscription_id: subscription.id,
          purchase_type: "SUBSCRIPTION",
          subtotal: proration.charge.toFixed(2),
          discount_amount: proration.credit.toFixed(2),
          tax_amount: "0.00",
          amount: proration.netAmount.toFixed(2),
          currency: newPricing.currency,
          status: proration.netAmount > 0 ? "PENDING" : "COMPLETED",
          due_date: new Date(),
          paid_date: proration.netAmount === 0 ? new Date() : null,
          description: `Plan change: ${subscription.tier} ${subscription.billing_cycle} → ${tier} ${billing_cycle} (Prorated)`,
        },
      });

      // Create invoice items
      // Credit for old plan
      if (proration.credit > 0) {
        await prisma.invoiceItem.create({
          data: {
            invoice_id: invoice.id,
            name: `${subscription.tier} ${subscription.billing_cycle} Credit`,
            description: `Unused time credit (${proration.daysRemaining} days remaining)`,
            quantity: 1,
            unit_price: (-proration.credit).toFixed(2),
            total_price: (-proration.credit).toFixed(2),
            metadata: {
              type: "credit",
              days_remaining: proration.daysRemaining,
            },
          },
        });
      }

      // Charge for new plan
      await prisma.invoiceItem.create({
        data: {
          invoice_id: invoice.id,
          name: `${tier} ${billing_cycle} Plan (Prorated)`,
          description: `Prorated charge for ${proration.daysRemaining} days`,
          quantity: 1,
          unit_price: proration.charge.toFixed(2),
          total_price: proration.charge.toFixed(2),
          metadata: {
            type: "prorated_charge",
            days_charged: proration.daysRemaining,
          },
        },
      });

      // If downgrade results in refund
      if (proration.refundAmount > 0) {
        return sendResponse(
          reply,
          httpStatus.OK,
          "Plan changed . You have a credit of $" +
            proration.refundAmount.toFixed(2),
          {
            subscription: updatedSubscription,
            invoice,
            proration,
            message: `Credit of $${proration.refundAmount.toFixed(2)} will be applied to your next invoice`,
          },
        );
      }

      // If no additional payment needed
      if (proration.netAmount === 0) {
        return sendResponse(
          reply,
          httpStatus.OK,
          "Plan changed . No additional payment required.",
          {
            subscription: updatedSubscription,
            invoice,
            proration,
          },
        );
      }

      // Additional payment needed
      return sendResponse(
        reply,
        httpStatus.OK,
        "Plan changed . Please complete the payment.",
        {
          subscription: updatedSubscription,
          invoice,
          proration,
        },
      );
    },
  );

  // Check feature access
  fastify.get(
    "/check-access/:id/:feature_name",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { id, feature_name } = request.params;
      const user_id = request.auth_id;

      const subscription = await prisma.subscription.findFirst({
        where: { id: parseInt(id), user_id },
      });

      if (!subscription) {
        throw throwError(httpStatus.NOT_FOUND, "Subscription not found");
      }

      const access = await subscriptionService.checkFeatureAccess(
        subscription.tier,
        subscription.status,
        feature_name,
      );

      return sendResponse(reply, httpStatus.OK, "Access checked", access);
    },
  );

  // Get available plans
  fastify.get("/plans", async (request, reply) => {
    const plans = await prisma.subscriptionPrice.findMany({
      where: { active: true },
      orderBy: [{ tier: "asc" }, { billing_cycle: "asc" }],
    });

    // Group by tier
    const groupedPlans = plans.reduce((acc, plan) => {
      if (!acc[plan.tier]) {
        acc[plan.tier] = [];
      }
      acc[plan.tier].push(plan);
      return acc;
    }, {});

    return sendResponse(reply, httpStatus.OK, "Plans retrieved", groupedPlans);
  });
}

export default subscriptionController;
