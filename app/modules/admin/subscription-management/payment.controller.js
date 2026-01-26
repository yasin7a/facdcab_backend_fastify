// Admin Payment Management Controller
import { prisma } from "../../../lib/prisma.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import offsetPagination from "../../../utilities/offsetPagination.js";
import { PaymentStatus } from "../../../utilities/constant.js";

async function adminPaymentController(fastify, options) {
  // Get all payments with filters
  fastify.get("/list", async (request, reply) => {
    const {
      status,
      user_id,
      payment_method,
      page = 1,
      limit = 20,
      search,
    } = request.query;

    const where = {};
    if (status) where.status = status;
    if (user_id) where.user_id = parseInt(user_id);
    if (payment_method) where.payment_method = payment_method;

    if (search) {
      where.OR = [
        { transaction_id: { contains: search, mode: "insensitive" } },
        { bank_tran_id: { contains: search, mode: "insensitive" } },
        {
          user: {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const result = await offsetPagination({
      model: prisma.payment,
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
        invoice: {
          select: {
            id: true,
            invoice_number: true,
            amount: true,
            status: true,
            subscription_id: true,
          },
        },
      },
    });

    sendResponse(reply, httpStatus.OK, "Payments retrieved", result);
  });

  // Get specific payment by ID
  fastify.get("/show/:id", async (request, reply) => {
    const { id } = request.params;

    const payment = await prisma.payment.findUnique({
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
        invoice: {
          include: {
            subscription: {
              select: {
                id: true,
                tier: true,
                billing_cycle: true,
                status: true,
              },
            },
            items: true,
          },
        },
      },
    });

    if (!payment) {
      throw throwError(httpStatus.NOT_FOUND, "Payment not found");
    }

    sendResponse(reply, httpStatus.OK, "Payment retrieved", payment);
  });

  // Get payment by transaction ID
  fastify.get("/transaction/:transaction_id", async (request, reply) => {
    const { transaction_id } = request.params;

    const payment = await prisma.payment.findFirst({
      where: { transaction_id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        invoice: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!payment) {
      throw throwError(httpStatus.NOT_FOUND, "Payment not found");
    }

    sendResponse(reply, httpStatus.OK, "Payment retrieved", payment);
  });

  // Get payment statistics
  fastify.get("/statistics", async (request, reply) => {
    const { start_date, end_date } = request.query;

    const where = {};
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at.gte = new Date(start_date);
      if (end_date) where.created_at.lte = new Date(end_date);
    }

    const [total, byStatus, totalAmount, byPaymentMethod] = await Promise.all([
      // Total payments
      prisma.payment.count({ where }),

      // Group by status
      prisma.payment.groupBy({
        by: ["status"],
        where,
        _count: true,
        _sum: {
          amount: true,
        },
      }),

      // Total amount (completed payments only)
      prisma.payment.aggregate({
        where: {
          ...where,
          status: PaymentStatus.COMPLETED,
        },
        _sum: {
          amount: true,
        },
      }),

      // Group by payment method
      prisma.payment.groupBy({
        by: ["payment_method"],
        where: {
          ...where,
          status: PaymentStatus.COMPLETED,
        },
        _count: true,
        _sum: {
          amount: true,
        },
      }),
    ]);

    sendResponse(reply, httpStatus.OK, "Payment statistics retrieved", {
      total,
      byStatus,
      totalAmount: totalAmount._sum.amount || 0,
      byPaymentMethod,
    });
  });

  // Get user payments (for viewing a specific user's payments)
  fastify.get("/user/:user_id", async (request, reply) => {
    const { user_id } = request.params;
    const { page = 1, limit = 20 } = request.query;

    const result = await offsetPagination({
      model: prisma.payment,
      page,
      limit,
      where: { user_id: parseInt(user_id) },
      orderBy: { created_at: "desc" },
      include: {
        invoice: {
          select: {
            id: true,
            invoice_number: true,
            amount: true,
            status: true,
            subscription: {
              select: {
                id: true,
                tier: true,
                billing_cycle: true,
              },
            },
          },
        },
      },
    });

    sendResponse(reply, httpStatus.OK, "User payments retrieved", result);
  });

  // Update payment status (for manual adjustments)
  fastify.put("/update-status/:id", async (request, reply) => {
    const { id } = request.params;
    const { status, notes } = request.body;

    if (!Object.values(PaymentStatus).includes(status)) {
      throw throwError(httpStatus.BAD_REQUEST, "Invalid payment status");
    }

    const payment = await prisma.payment.update({
      where: { id: parseInt(id) },
      data: {
        status,
        metadata: {
          ...(payment.metadata || {}),
          admin_notes: notes,
          admin_updated_at: new Date().toISOString(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        invoice: true,
      },
    });

    sendResponse(reply, httpStatus.OK, "Payment status updated", payment);
  });
}

export default adminPaymentController;
