// Admin Subscription Management Controller
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { adminSchemas } from "../../../validators/validations.js";
import offsetPagination from "../../../utilities/offsetPagination.js";
import {
  SubscriptionStatus,
  PaymentStatus,
} from "../../../utilities/constant.js";

async function adminSubscriptionController(fastify, options) {
  // Get all subscriptions with filters
  fastify.get("/list", async (request, reply) => {
    const { status, tier, page = 1, limit = 20, search } = request.query;

    const where = {};
    if (status) where.status = status;
    if (tier) where.tier = tier;

    if (search) {
      where.user = {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { first_name: { contains: search, mode: "insensitive" } },
          { last_name: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const result = await offsetPagination({
      model: prisma.subscription,
      page,
      limit,
      where,
      orderBy: { created_at: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        invoices: {
          select: {
            id: true,
            invoice_number: true,
            amount: true,
            status: true,
          },
        },
      },
    });

    sendResponse(reply, httpStatus.OK, "Subscriptions retrieved", result);
  });

  // Get subscription by ID
  fastify.get("/show/:id", async (request, reply) => {
    const { id } = request.params;

    const subscription = await prisma.subscription.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            phone_number: true,
          },
        },
        invoices: {
          include: {
            payments: true,
            items: true,
          },
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!subscription) {
      throw throwError(httpStatus.NOT_FOUND, "Subscription not found");
    }

    sendResponse(reply, httpStatus.OK, "Subscription retrieved", subscription);
  });

  // Manually activate subscription
  fastify.patch(
    "/activate/:id",
    {
      preHandler: validate(adminSchemas.subscription.updateSubscriptionStatus),
    },
    async (request, reply) => {
      const { id } = request.params;
      const { notes } = request.body;

      const subscription = await prisma.subscription.update({
        where: { id: parseInt(id) },
        data: {
          status: SubscriptionStatus.ACTIVE,
          updated_at: new Date(),
        },
      });

      // Add admin note to latest invoice
      if (subscription.id) {
        await prisma.invoice.updateMany({
          where: { subscription_id: subscription.id },
          data: {
            notes: notes || "Manually activated by admin",
          },
        });
      }

      sendResponse(
        reply,
        httpStatus.OK,
        "Subscription activated",
        subscription,
      );
    },
  );

  // Cancel subscription (admin)
  fastify.patch(
    "/cancel/:id",
    {
      preHandler: validate(adminSchemas.subscription.updateSubscriptionStatus),
    },
    async (request, reply) => {
      const { id } = request.params;
      const { notes } = request.body;

      const subscription = await prisma.subscription.update({
        where: { id: parseInt(id) },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelled_at: new Date(),
          auto_renew: false,
        },
      });

      // Add admin note
      await prisma.invoice.updateMany({
        where: { subscription_id: subscription.id },
        data: {
          notes: notes || "Cancelled by admin",
        },
      });

      sendResponse(
        reply,
        httpStatus.OK,
        "Subscription cancelled",
        subscription,
      );
    },
  );

  // Get subscription statistics
  fastify.get("/stats/overview", async (request, reply) => {
    const [
      totalSubscriptions,
      activeSubscriptions,
      cancelledSubscriptions,
      expiredSubscriptions,
      revenueData,
      tierDistribution,
    ] = await Promise.all([
      prisma.subscription.count(),
      prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      prisma.subscription.count({
        where: { status: SubscriptionStatus.CANCELLED },
      }),
      prisma.subscription.count({
        where: { status: SubscriptionStatus.EXPIRED },
      }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.subscription.groupBy({
        by: ["tier"],
        _count: true,
      }),
    ]);

    sendResponse(reply, httpStatus.OK, "Statistics retrieved", {
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        cancelled: cancelledSubscriptions,
        expired: expiredSubscriptions,
      },
      revenue: {
        total: revenueData._sum.amount || 0,
        transactions: revenueData._count,
      },
      tier_distribution: tierDistribution,
    });
  });
}

export default adminSubscriptionController;
