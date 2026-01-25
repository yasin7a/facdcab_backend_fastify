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

async function subscriptionController(fastify, options) {
  const subscriptionService = new SubscriptionService();
  const invoiceService = new InvoiceService();

  // Create subscription
  fastify.post(
    "/create",
    {
      preHandler: [verifyAuth, validate(schemas.createSubscription)],
    },
    async (request, reply) => {
      const { tier, billing_cycle, coupon_code } = request.body;
      const user_id = request.auth_id;

      // Check if user already has an active subscription
      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          user_id,
          status: { in: ["ACTIVE", "PENDING"] },
        },
      });

      if (existingSubscription) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "You already have an active subscription",
        );
      }

      // Get pricing
      const pricing = await subscriptionService.getPricing(
        tier,
        billing_cycle,
        "USD",
      );

      if (!pricing) {
        throw throwError(
          httpStatus.NOT_FOUND,
          "Pricing not found for this plan",
        );
      }

      // Calculate dates
      const dates = subscriptionService.calculateDates(billing_cycle);

      // Create subscription
      const subscription = await prisma.subscription.create({
        data: {
          user_id,
          tier,
          billing_cycle,
          status: "PENDING",
          start_date: dates.startDate,
          end_date: dates.endDate,
        },
      });

      // Generate invoice
      const invoiceData = await invoiceService.generateSubscriptionInvoice({
        user_id,
        subscription_id: subscription.id,
        tier,
        billing_cycle,
        pricing,
        coupon_code,
      });

      sendResponse(reply, httpStatus.CREATED, "Subscription created", {
        subscription,
        invoice: invoiceData,
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

      sendResponse(
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

      sendResponse(reply, httpStatus.OK, "Features retrieved", {
        subscription,
        features,
      });
    },
  );

  // Cancel subscription
  fastify.patch(
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

      const updatedSubscription = await prisma.subscription.update({
        where: { id: parseInt(id) },
        data: {
          status: "CANCELLED",
          cancelled_at: new Date(),
          auto_renew: false,
        },
      });

      sendResponse(
        reply,
        httpStatus.OK,
        "Subscription cancelled",
        updatedSubscription,
      );
    },
  );

  // Check feature access
  fastify.get(
    "/check-access/:id/:featureName",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { id, featureName } = request.params;
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
        featureName,
      );

      sendResponse(reply, httpStatus.OK, "Access checked", access);
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

    sendResponse(reply, httpStatus.OK, "Plans retrieved", groupedPlans);
  });
}

export default subscriptionController;
