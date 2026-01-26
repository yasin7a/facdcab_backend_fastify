// Admin Invoice Management Controller
import { prisma } from "../../../lib/prisma.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import offsetPagination from "../../../utilities/offsetPagination.js";
import { InvoiceStatus } from "../../../utilities/constant.js";

async function adminInvoiceController(fastify, options) {
  // Get all invoices with filters
  fastify.get("/list", async (request, reply) => {
    const { status, user_id, page = 1, limit = 20, search } = request.query;

    const where = {};
    if (status) where.status = status;
    if (user_id) where.user_id = parseInt(user_id);

    if (search) {
      where.OR = [
        { invoice_number: { contains: search, mode: "insensitive" } },
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
      model: prisma.invoice,
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
        subscription: {
          select: {
            id: true,
            tier: true,
            billing_cycle: true,
            status: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            payment_method: true,
            created_at: true,
          },
        },
        items: true,
      },
    });

    sendResponse(reply, httpStatus.OK, "Invoices retrieved", result);
  });

  // Get specific invoice by ID
  fastify.get("/show/:id", async (request, reply) => {
    const { id } = request.params;

    const invoice = await prisma.invoice.findUnique({
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
        subscription: {
          select: {
            id: true,
            tier: true,
            billing_cycle: true,
            status: true,
            start_date: true,
            end_date: true,
          },
        },
        payments: {
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
        },
        items: true,
        refunds: {
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!invoice) {
      throw throwError(httpStatus.NOT_FOUND, "Invoice not found");
    }

    sendResponse(reply, httpStatus.OK, "Invoice retrieved", invoice);
  });

  // Get invoice by invoice number
  fastify.get("/number/:invoiceNumber", async (request, reply) => {
    const { invoiceNumber } = request.params;

    const invoice = await prisma.invoice.findUnique({
      where: { invoice_number: invoiceNumber },
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
        subscription: true,
        payments: {
          orderBy: { created_at: "desc" },
        },
        items: true,
        refunds: true,
      },
    });

    if (!invoice) {
      throw throwError(httpStatus.NOT_FOUND, "Invoice not found");
    }

    sendResponse(reply, httpStatus.OK, "Invoice retrieved", invoice);
  });

  // Update invoice status
  fastify.put("/update-status/:id", async (request, reply) => {
    const { id } = request.params;
    const { status, notes } = request.body;

    if (!Object.values(InvoiceStatus).includes(status)) {
      throw throwError(httpStatus.BAD_REQUEST, "Invalid invoice status");
    }

    const invoice = await prisma.invoice.update({
      where: { id: parseInt(id) },
      data: {
        status,
        notes: notes || null,
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
        subscription: true,
      },
    });

    sendResponse(reply, httpStatus.OK, "Invoice status updated", invoice);
  });

  // Add notes to invoice
  fastify.put("/add-notes/:id", async (request, reply) => {
    const { id } = request.params;
    const { notes } = request.body;

    if (!notes) {
      throw throwError(httpStatus.BAD_REQUEST, "Notes are required");
    }

    const invoice = await prisma.invoice.update({
      where: { id: parseInt(id) },
      data: {
        notes,
      },
    });

    sendResponse(reply, httpStatus.OK, "Notes added to invoice", invoice);
  });

  // Get invoice statistics
  fastify.get("/statistics", async (request, reply) => {
    const { start_date, end_date } = request.query;

    const where = {};
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at.gte = new Date(start_date);
      if (end_date) where.created_at.lte = new Date(end_date);
    }

    const [total, byStatus, totalRevenue, byTier] = await Promise.all([
      // Total invoices
      prisma.invoice.count({ where }),

      // Group by status
      prisma.invoice.groupBy({
        by: ["status"],
        where,
        _count: true,
        _sum: {
          amount: true,
        },
      }),

      // Total revenue (paid invoices only)
      prisma.invoice.aggregate({
        where: {
          ...where,
          status: InvoiceStatus.PAID,
        },
        _sum: {
          amount: true,
        },
      }),

      // Revenue by tier
      prisma.invoice.groupBy({
        by: ["subscription"],
        where: {
          ...where,
          status: InvoiceStatus.PAID,
          subscription_id: { not: null },
        },
        _sum: {
          amount: true,
        },
        _count: true,
      }),
    ]);

    sendResponse(reply, httpStatus.OK, "Invoice statistics retrieved", {
      total,
      byStatus,
      totalRevenue: totalRevenue._sum.amount || 0,
      byTier,
    });
  });

  // Get user invoices (for viewing a specific user's invoices)
  fastify.get("/user/:user_id", async (request, reply) => {
    const { user_id } = request.params;
    const { page = 1, limit = 20 } = request.query;

    const result = await offsetPagination({
      model: prisma.invoice,
      page,
      limit,
      where: { user_id: parseInt(user_id) },
      orderBy: { created_at: "desc" },
      include: {
        subscription: {
          select: {
            id: true,
            tier: true,
            billing_cycle: true,
            status: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            payment_method: true,
            created_at: true,
          },
        },
        items: true,
      },
    });

    sendResponse(reply, httpStatus.OK, "User invoices retrieved", result);
  });
}

export default adminInvoiceController;
