// Admin Feature Management Controller
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { adminSchemas } from "../../../validators/validations.js";
import { SubscriptionTier } from "../../../utilities/constant.js";

async function adminFeatureController(fastify, options) {
  // Get all features
  fastify.get("/list", async (request, reply) => {
    const features = await prisma.feature.findMany({
      include: {
        tiers: true,
      },
      orderBy: { created_at: "desc" },
    });

    sendResponse(reply, httpStatus.OK, "Features retrieved", features);
  });

  // Create feature
  fastify.post(
    "/create",
    {
      preHandler: validate(adminSchemas.createFeature),
    },
    async (request, reply) => {
      const { name, description } = request.body;

      // Check if feature exists
      const existing = await prisma.feature.findUnique({
        where: { name },
      });

      if (existing) {
        throw throwError(httpStatus.BAD_REQUEST, "Feature already exists");
      }

      const feature = await prisma.feature.create({
        data: { name, description },
      });

      sendResponse(reply, httpStatus.OK, "Feature created", feature);
    },
  );

  // Update feature
  fastify.patch(
    "/update/:id",
    {
      preHandler: validate(adminSchemas.updateFeature),
    },
    async (request, reply) => {
      const { id } = request.params;
      const { name, description } = request.body;

      const feature = await prisma.feature.update({
        where: { id: parseInt(id) },
        data: { name, description },
      });

      sendResponse(reply, httpStatus.OK, "Feature updated", feature);
    },
  );

  // Delete feature
  fastify.delete("/delete/:id", async (request, reply) => {
    const { id } = request.params;

    await prisma.feature.delete({
      where: { id: parseInt(id) },
    });

    sendResponse(reply, httpStatus.OK, "Feature deleted", null);
  });

  // Assign feature to tier
  fastify.post(
    "/assign-tier/:id",
    {
      preHandler: validate(adminSchemas.assignFeatureToTier),
    },
    async (request, reply) => {
      const { id } = request.params;
      const { tier, enabled, limit } = request.body;

      const feature = await prisma.feature.findUnique({
        where: { id: parseInt(id) },
      });

      if (!feature) {
        throw throwError(httpStatus.NOT_FOUND, "Feature not found");
      }

      const tierFeature = await prisma.tierFeature.upsert({
        where: {
          tier_feature_id: {
            tier,
            feature_id: parseInt(id),
          },
        },
        update: {
          enabled,
          limit,
        },
        create: {
          tier,
          feature_id: parseInt(id),
          enabled,
          limit,
        },
      });

      sendResponse(
        reply,
        httpStatus.OK,
        "Feature assigned to tier",
        tierFeature,
      );
    },
  );

  // Remove feature from tier
  fastify.delete(
    "/remove-tier/:feature_id/:tier_id",
    async (request, reply) => {
      const featureId = parseInt(request.params.feature_id);
      const tierId = parseInt(request.params.tier_id);

      await prisma.tierFeature.delete({
        where: {
          tier_feature_id: {
            tier: tierId,
            feature_id: featureId,
          },
        },
      });

      sendResponse(reply, httpStatus.OK, "Feature removed from tier", null);
    },
  );

  // Get tier features matrix
  fastify.get("/matrix", async (request, reply) => {
    const features = await prisma.feature.findMany({
      include: {
        tiers: true,
      },
    });

    const matrix = Object.fromEntries(
      Object.values(SubscriptionTier).map((tier) => [tier, []]),
    );

    features.forEach((feature) => {
      feature.tiers.forEach((tierFeature) => {
        matrix[tierFeature.tier].push({
          id: feature.id,
          name: feature.name,
          description: feature.description,
          enabled: tierFeature.enabled,
          limit: tierFeature.limit,
        });
      });
    });

    sendResponse(reply, httpStatus.OK, "Feature matrix retrieved", matrix);
  });
}

export default adminFeatureController;
