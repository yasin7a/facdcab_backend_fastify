import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import httpStatus from "../../../utilities/httpStatus.js";
import isNullOrEmpty from "../../../utilities/isNullOrEmpty.js";
import offsetPagination from "../../../utilities/offsetPagination.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import toBoolean from "../../../utilities/toBoolean.js";
import { adminSchemas } from "../../../validators/validations.js";

async function adminCouponController(fastify, options) {
  // Get all coupons
  fastify.get("/list", async (request, reply) => {
    const { is_active, page = 1, limit = 20 } = request.query;

    const where = {};
    if (!isNullOrEmpty(is_active)) {
      where.is_active = toBoolean(is_active);
    }

    const result = await offsetPagination({
      model: prisma.coupon,
      page,
      limit,
      where,
    });

    // Get usage count for each coupon
    const couponsWithUsage = await Promise.all(
      result.data.map(async (coupon) => {
        const usageCount = await prisma.invoice.count({
          where: { coupon_code: coupon.code },
        });
        return { ...coupon, usage_count: usageCount };
      }),
    );

    sendResponse(reply, httpStatus.OK, "Coupons retrieved", {
      coupons: couponsWithUsage,
      pagination: result.pagination,
    });
  });

  // Create coupon
  fastify.post(
    "/create",
    {
      preHandler: validate(adminSchemas.coupon.createCoupon),
    },
    async (request, reply) => {
      const {
        code,
        type,
        discount_value,
        min_purchase_amount,
        max_uses,
        max_uses_per_user,
        valid_from,
        valid_until,
        is_active,
        applicable_tiers,
        applicable_cycles,
        purchase_types,
      } = request.body;

      // Check if code already exists
      const existing = await prisma.coupon.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (existing) {
        throw throwError(httpStatus.BAD_REQUEST, "Coupon code already exists");
      }

      const coupon = await prisma.coupon.create({
        data: {
          code: code.toUpperCase(),
          type,
          discount_value,
          min_purchase_amount,
          max_uses,
          max_uses_per_user,
          valid_from: valid_from ? new Date(valid_from) : new Date(),
          valid_until: valid_until ? new Date(valid_until) : null,
          is_active,
          applicable_tiers,
          applicable_cycles,
          purchase_types,
        },
      });

      sendResponse(reply, httpStatus.CREATED, "Coupon created", coupon);
    },
  );

  // Update coupon
  fastify.put(
    "/update/:id",
    {
      preHandler: validate(adminSchemas.coupon.updateCoupon),
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

      const coupon = await prisma.coupon.update({
        where: { id: parseInt(id) },
        data: updateData,
      });

      sendResponse(reply, httpStatus.OK, "Coupon updated", coupon);
    },
  );

  // Delete coupon
  fastify.delete("/delete/:id", async (request, reply) => {
    const { id } = request.params;

    await prisma.coupon.delete({
      where: { id: parseInt(id) },
    });

    sendResponse(reply, httpStatus.OK, "Coupon deleted", null);
  });

  // Get coupon usage statistics
  fastify.get("/statistics/:id", async (request, reply) => {
    const { id } = request.params;

    const coupon = await prisma.coupon.findUnique({
      where: { id: parseInt(id) },
    });

    if (!coupon) {
      throw throwError(httpStatus.NOT_FOUND, "Coupon not found");
    }

    const [totalUsage, uniqueUsers, totalDiscount, recentUsage] =
      await Promise.all([
        prisma.invoice.count({ where: { coupon_code: coupon.code } }),
        prisma.invoice.groupBy({
          by: ["user_id"],
          where: { coupon_code: coupon.code },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: { coupon_code: coupon.code },
          _sum: { discount_amount: true },
        }),
        prisma.invoice.findMany({
          where: { coupon_code: coupon.code },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
          },
          orderBy: { created_at: "desc" },
          take: 10,
        }),
      ]);

    sendResponse(reply, httpStatus.OK, "Coupon statistics retrieved", {
      coupon,
      stats: {
        total_usage: totalUsage,
        unique_users: uniqueUsers.length,
        total_discount: totalDiscount._sum.discount_amount || 0,
        recent_usage: recentUsage,
      },
    });
  });
}

export default adminCouponController;
