// Admin Pricing Management Controller
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { adminSchemas } from "../../../validators/validations.js";
import isNullOrEmpty from "../../../utilities/isNullOrEmpty.js";
import toBoolean from "../../../utilities/toBoolean.js";
import { SubscriptionStatus } from "../../../utilities/constant.js";

async function adminPricingController(fastify, options) {
  // Get all subscription prices
  fastify.get("/list", async (request, reply) => {
    const { tier, billing_cycle, active } = request.query;

    const where = {};
    if (tier) where.tier = tier;
    if (billing_cycle) where.billing_cycle = billing_cycle;
    if (!isNullOrEmpty(active)) where.active = toBoolean(active);

    const prices = await prisma.subscriptionPrice.findMany({
      where,
      orderBy: [{ tier: "asc" }, { billing_cycle: "asc" }],
    });

    // Group by tier
    const groupedPrices = prices.reduce((acc, price) => {
      if (!acc[price.tier]) {
        acc[price.tier] = [];
      }
      acc[price.tier].push(price);
      return acc;
    }, {});

    sendResponse(reply, httpStatus.OK, "Pricing retrieved", {
      all: prices,
      grouped: groupedPrices,
    });
  });

  // Create subscription price
  fastify.post(
    "/create",
    {
      preHandler: validate(adminSchemas.createSubscriptionPrice),
    },
    async (request, reply) => {
      const {
        tier,
        billing_cycle,
        price,
        currency,
        active,
        region,
        valid_from,
        valid_until,
        discount_pct,
        promo_code,
      } = request.body;

      // Check if price already exists
      const existing = await prisma.subscriptionPrice.findFirst({
        where: {
          tier,
          billing_cycle,
          currency: currency || "USD",
          region: region || null,
        },
      });

      if (existing) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Price already exists for this combination",
        );
      }

      const subscriptionPrice = await prisma.subscriptionPrice.create({
        data: {
          tier,
          billing_cycle,
          price,
          currency: currency || "USD",
          active: active !== undefined ? active : true,
          region,
          valid_from: valid_from ? new Date(valid_from) : null,
          valid_until: valid_until ? new Date(valid_until) : null,
          discount_pct,
          promo_code,
        },
      });

      sendResponse(
        reply,
        httpStatus.CREATED,
        "Subscription price created",
        subscriptionPrice,
      );
    },
  );

  // Update subscription price
  fastify.patch(
    "/update/:id",
    {
      preHandler: validate(adminSchemas.updateSubscriptionPrice),
    },
    async (request, reply) => {
      const { id } = request.params;
      const updateData = request.body;

      if (updateData.valid_from) {
        updateData.valid_from = new Date(updateData.valid_from);
      }
      if (updateData.valid_until) {
        updateData.valid_until = new Date(updateData.valid_until);
      }

      const subscriptionPrice = await prisma.subscriptionPrice.update({
        where: { id: parseInt(id) },
        data: updateData,
      });

      sendResponse(
        reply,
        httpStatus.OK,
        "Subscription price updated",
        subscriptionPrice,
      );
    },
  );

  // Delete subscription price
  fastify.delete("/delete/:id", async (request, reply) => {
    const { id } = request.params;

    // Check if any active subscriptions use this price
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        status: SubscriptionStatus.ACTIVE,
        // Note: We'd need to add price_id to subscription model to track this properly
        // For now, just delete
      },
    });

    await prisma.subscriptionPrice.delete({
      where: { id: parseInt(id) },
    });

    sendResponse(reply, httpStatus.OK, "Subscription price deleted", null);
  });
}

export default adminPricingController;
