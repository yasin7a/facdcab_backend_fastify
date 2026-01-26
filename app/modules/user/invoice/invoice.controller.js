// Invoice controller
import { prisma } from "../../../lib/prisma.js";
import verifyAuth from "../../../middleware/verifyAuth.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";

async function invoiceController(fastify, options) {
  // Get all  invoices for a user
  fastify.get(
    "/list",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const user_id = request.auth_id;
      const { status, page = 1, limit = 10 } = request.query;

      const where = { user_id };
      if (status) {
        where.status = status;
      }

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: {
            subscription: true,
            payments: true,
            items: true,
          },
          orderBy: { created_at: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.invoice.count({ where }),
      ]);

      return sendResponse(reply, httpStatus.OK, "Invoices retrieved", {
        invoices,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      });
    },
  );

  // Get specific invoice
  fastify.get(
    "/show/:id",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { id } = request.params;
      const user_id = request.auth_id;

      const invoice = await prisma.invoice.findFirst({
        where: { id: parseInt(id), user_id },
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
          payments: true,
          items: true,
          refunds: true,
        },
      });

      if (!invoice) {
        throw throwError(httpStatus.NOT_FOUND, "Invoice not found");
      }

      return sendResponse(reply, httpStatus.OK, "Invoice retrieved", invoice);
    },
  );

  // Get invoice by invoice number
  fastify.get(
    "/number/:invoiceNumber",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { invoiceNumber } = request.params;
      const user_id = request.auth_id;

      const invoice = await prisma.invoice.findFirst({
        where: { invoice_number: invoiceNumber, user_id },
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
          payments: true,
          items: true,
        },
      });

      if (!invoice) {
        throw throwError(httpStatus.NOT_FOUND, "Invoice not found");
      }

      return sendResponse(reply, httpStatus.OK, "Invoice retrieved", invoice);
    },
  );

  // Download invoice PDF (placeholder - you can integrate PDF generation)
  fastify.get(
    "/download/:id",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { id } = request.params;
      const user_id = request.auth_id;

      const invoice = await prisma.invoice.findFirst({
        where: { id: parseInt(id), user_id },
        include: {
          user: true,
          subscription: true,
          items: true,
        },
      });

      if (!invoice) {
        throw throwError(httpStatus.NOT_FOUND, "Invoice not found");
      }

      // TODO: Implement PDF generation using pdfGenerator utility
      return sendResponse(reply, httpStatus.OK, "PDF download will be implemented", {
        message: "Invoice PDF generation coming soon",
        invoice,
      });
    },
  );
}

export default invoiceController;
