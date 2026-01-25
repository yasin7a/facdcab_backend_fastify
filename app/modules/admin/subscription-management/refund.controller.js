// Admin Refund Management Controller
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { adminSchemas } from "../../../validators/validations.js";
import SSLCommerzService from "../../../services/sslcommerz.service.js";
import PaymentService from "../../../services/payment.service.js";
import offsetPagination from "../../../utilities/offsetPagination.js";
import { RefundStatus, PaymentStatus } from "../../../utilities/constant.js";

async function adminRefundController(fastify, options) {
  const sslCommerzService = new SSLCommerzService();
  const paymentService = new PaymentService();

  // Get all refund requests
  fastify.get("/list", async (request, reply) => {
    const { status, page = 1, limit = 20 } = request.query;

    const where = {};
    if (status) where.status = status;

    const data = await offsetPagination({
      model: prisma.refund,
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
          include: {
            payments: true,
            subscription: true,
          },
        },
      },
    });

    sendResponse(reply, httpStatus.OK, "Refunds retrieved", data);
  });

  // Approve and process refund
  fastify.post(
    "/approve/:id",
    {
      preHandler: validate(adminSchemas.processRefund),
    },
    async (request, reply) => {
      const { id } = request.params;
      const { notes } = request.body;

      const refund = await prisma.refund.findUnique({
        where: { id: parseInt(id) },
        include: {
          invoice: {
            include: {
              payments: {
                where: { status: PaymentStatus.COMPLETED },
                orderBy: { created_at: "desc" },
                take: 1,
              },
            },
          },
        },
      });

      if (!refund) {
        throw throwError(httpStatus.NOT_FOUND, "Refund request not found");
      }

      if (refund.status !== RefundStatus.PENDING) {
        throw throwError(httpStatus.BAD_REQUEST, "Refund already processed");
      }

      // Get payment details
      const payment = refund.invoice.payments[0];
      if (!payment || !payment.metadata?.bank_tran_id) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Payment transaction not found",
        );
      }

        // Initiate refund with SSLCommerz
        const refundResponse = await sslCommerzService.initiateRefund({
          bank_tran_id: payment.metadata.bank_tran_id,
          refund_amount: parseFloat(refund.amount),
          refund_remarks: refund.reason || "Refund approved by admin",
        });

        // Update refund status
        const updatedRefund = await prisma.refund.update({
          where: { id: parseInt(id) },
          data: {
            status: RefundStatus.COMPLETED,
          },
        });

        // Process refund in payment service
        await paymentService.processRefund(updatedRefund.id, refundResponse);

        // Add admin note to invoice
        await prisma.invoice.update({
          where: { id: refund.invoice_id },
          data: {
            notes:
              notes || `Refund approved by admin: ${refundResponse.status}`,
          },
        });

        sendResponse(reply, httpStatus.OK, "Refund processed", updatedRefund);
    
    },
  );

  // Reject refund
  fastify.post(
    "/reject/:id",
    {
      preHandler: validate(adminSchemas.processRefund),
    },
    async (request, reply) => {
      const { id } = request.params;
      const { notes } = request.body;

      const refund = await prisma.refund.update({
        where: { id: parseInt(id) },
        data: {
          status: RefundStatus.REJECTED,
        },
      });

      // Add admin note
      await prisma.invoice.update({
        where: { id: refund.invoice_id },
        data: {
          notes: notes || "Refund rejected by admin",
        },
      });

      sendResponse(reply, httpStatus.OK, "Refund rejected", refund);
    },
  );
}

export default adminRefundController;
