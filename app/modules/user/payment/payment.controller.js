// Payment controller with SSLCommerz integration
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import verifyAuth from "../../../middleware/verifyAuth.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { schemas } from "../../../validators/validations.js";
import PaymentService from "../../../services/payment.service.js";
import SSLCommerzService from "../../../services/sslcommerz.service.js";
import {
  InvoiceStatus,
  PaymentStatus,
  RefundStatus,
} from "../../../utilities/constant.js";

async function paymentController(fastify, options) {
  const paymentService = new PaymentService();
  const sslCommerzService = new SSLCommerzService();

  // Initiate payment
  fastify.post(
    "/initiate",
    {
      preHandler: [verifyAuth, validate(schemas.payment.initiatePayment)],
    },
    async (request, reply) => {
      const { invoice_id, payment_method } = request.body;
      const user = request.user;

      // Get invoice details
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoice_id },
        include: {
          user: true,
          subscription: true,
          items: true,
        },
      });

      if (!invoice) {
        throw throwError(httpStatus.NOT_FOUND, "Invoice not found");
      }

      if (invoice.user_id !== user.id) {
        throw throwError(
          httpStatus.FORBIDDEN,
          "You are not authorized to pay this invoice",
        );
      }

      if (invoice.status === InvoiceStatus.PAID) {
        throw throwError(httpStatus.BAD_REQUEST, "Invoice already paid");
      }

      // Initiate SSLCommerz payment
      const paymentData = await sslCommerzService.initiatePayment({
        invoice,
        user,
        payment_method,
      });

      // Create pending payment record
      const payment = await prisma.payment.create({
        data: {
          invoice_id: invoice.id,
          user_id: user.id,
          amount: invoice.amount,
          currency: invoice.currency,
          status: PaymentStatus.PENDING,
          payment_method,
          payment_provider: "sslcommerz",
          transaction_id: paymentData.sessionkey,
          metadata: {
            gateway_response: paymentData,
          },
        },
      });

      sendResponse(reply, httpStatus.OK, "Payment initiated", {
        payment,
        gateway_url: paymentData.GatewayPageURL,
      });
    },
  );

  // SSLCommerz success callback
  fastify.post("/sslcommerz/success", async (request, reply) => {
    const data = request.body;

    try {
      // Validate transaction
      const validationResult = await sslCommerzService.validateTransaction(
        data.val_id,
      );

      if (
        validationResult.status === "VALID" ||
        validationResult.status === "VALIDATED"
      ) {
        // Find payment by transaction ID
        const payment = await prisma.payment.findFirst({
          where: { transaction_id: data.sessionkey },
          include: { invoice: { include: { subscription: true } } },
        });

        if (!payment) {
          throw throwError(httpStatus.NOT_FOUND, "Payment not found");
        }

        // Update payment status
        await paymentService.completePayment(payment.id, {
          transaction_id: data.tran_id,
          bank_tran_id: data.bank_tran_id,
          card_type: data.card_type,
          card_brand: data.card_brand,
          validationResult,
        });

        // Redirect to success page
        return reply.redirect(
          `${process.env.FRONTEND_URL}/payment/success?invoice=${payment.invoice_id}`,
        );
      } else {
        throw throwError(httpStatus.BAD_REQUEST, "Invalid transaction");
      }
    } catch (error) {
      fastify.log.error(error);
      return reply.redirect(
        `${process.env.FRONTEND_URL}/payment/failed?error=${error.message}`,
      );
    }
  });

  // SSLCommerz fail callback
  fastify.post("/sslcommerz/fail", async (request, reply) => {
    const data = request.body;

    try {
      const payment = await prisma.payment.findFirst({
        where: { transaction_id: data.sessionkey },
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            metadata: {
              ...(payment.metadata || {}),
              failure_reason: data.error || "Payment failed",
            },
          },
        });
      }
    } catch (error) {
      fastify.log.error(error);
    }

    return reply.redirect(
      `${process.env.FRONTEND_URL}/payment/failed?reason=${data.error || "Payment failed"}`,
    );
  });

  // SSLCommerz cancel callback
  fastify.post("/sslcommerz/cancel", async (request, reply) => {
    const data = request.body;

    try {
      const payment = await prisma.payment.findFirst({
        where: { transaction_id: data.sessionkey },
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            metadata: {
              ...(payment.metadata || {}),
              cancellation_reason: "User cancelled",
            },
          },
        });
      }
    } catch (error) {
      fastify.log.error(error);
    }

    return reply.redirect(`${process.env.FRONTEND_URL}/payment/cancelled`);
  });

  // Get payment history
  fastify.get(
    "/history",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const user_id = request.auth_id;

      const payments = await prisma.payment.findMany({
        where: { user_id },
        include: {
          invoice: {
            include: {
              subscription: true,
              items: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
      });

      sendResponse(reply, httpStatus.OK, "Payment history retrieved", payments);
    },
  );

  // Get specific payment
  fastify.get(
    "/show/:id",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { id } = request.params;
      const user_id = request.auth_id;

      const payment = await prisma.payment.findFirst({
        where: { id: parseInt(id), user_id },
        include: {
          invoice: {
            include: {
              subscription: true,
              items: true,
            },
          },
        },
      });

      if (!payment) {
        throw throwError(httpStatus.NOT_FOUND, "Payment not found");
      }

      sendResponse(reply, httpStatus.OK, "Payment retrieved", payment);
    },
  );

  // Request refund
  fastify.post(
    "/refund/:id",
    {
      preHandler: [verifyAuth, validate(schemas.payment.requestRefund)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { reason, amount } = request.body;
      const user_id = request.auth_id;

      const payment = await prisma.payment.findFirst({
        where: { id: parseInt(id), user_id },
        include: { invoice: true },
      });

      if (!payment) {
        throw throwError(httpStatus.NOT_FOUND, "Payment not found");
      }

      if (payment.status !== PaymentStatus.COMPLETED) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Only completed payments can be refunded",
        );
      }

      // Create refund request
      const refund = await prisma.refund.create({
        data: {
          invoice_id: payment.invoice_id,
          user_id,
          amount: amount || payment.amount,
          reason,
          status: RefundStatus.PENDING,
        },
      });

      sendResponse(
        reply,
        httpStatus.CREATED,
        "Refund request submitted",
        refund,
      );
    },
  );
}

export default paymentController;
