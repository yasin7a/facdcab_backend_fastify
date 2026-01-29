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
import serverConfig from "../../../../config/server.config.js";

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

    // Get tier features for each unique tier
    const uniqueTiers = [...new Set(prices.map((p) => p.tier))];
    const tierFeaturesMap = {};

    for (const tier of uniqueTiers) {
      const features = await prisma.tierFeature.findMany({
        where: { tier },
        include: {
          feature: true,
        },
        orderBy: { feature: { name: "asc" } },
      });

      tierFeaturesMap[tier] = features.map((tf) => ({
        id: tf.feature.id,
        name: tf.feature.name,
        description: tf.feature.description,
        enabled: tf.enabled,
        limit: tf.limit,
      }));
    }

    // Group by tier with features
    const groupedPrices = prices.reduce((acc, price) => {
      if (!acc[price.tier]) {
        acc[price.tier] = {
          prices: [],
          features: tierFeaturesMap[price.tier] || [],
        };
      }
      acc[price.tier].prices.push(price);
      return acc;
    }, {});

    return sendResponse(reply, httpStatus.OK, "Pricing retrieved", {
      all: prices,
      grouped: groupedPrices,
    });
  });

  // Create subscription price
  fastify.post(
    "/create",
    {
      preHandler: validate(adminSchemas.subscription.createSubscriptionPrice),
    },
    async (request, reply) => {
      const {
        tier,
        billing_cycle,
        price,
        setup_fee,
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
          currency: currency || serverConfig.CURRENCY,
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
          setup_fee: setup_fee || 0,
          currency: currency || serverConfig.CURRENCY,
          active: active !== undefined ? active : true,
          region,
          valid_from: valid_from ? new Date(valid_from) : null,
          valid_until: valid_until ? new Date(valid_until) : null,
          discount_pct: discount_pct || null,
          promo_code,
        },
      });

      return sendResponse(
        reply,
        httpStatus.CREATED,
        "Subscription price created",
        subscriptionPrice,
      );
    },
  );

  // Update subscription price
  fastify.put(
    "/update/:id",
    {
      preHandler: validate(adminSchemas.subscription.updateSubscriptionPrice),
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

      return sendResponse(
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

    return sendResponse(reply, httpStatus.OK, "Subscription price deleted");
  });
}

export default adminPricingController;
