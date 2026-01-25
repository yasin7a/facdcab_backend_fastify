// User Sponsorship Controller - Purchase sponsorships
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import verifyAuth from "../../../middleware/verifyAuth.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { schemas } from "../../../validators/validations.js";
import EventService from "../../../services/event.service.js";
import SSLCommerzService from "../../../services/sslcommerz.service.js";
import { SponsorshipStatus } from "../../../utilities/constant.js";
import { fileUploadPreHandler } from "../../../middleware/fileUploader.js";

async function userSponsorshipController(fastify, options) {
  const eventService = new EventService();
  const sslCommerzService = new SSLCommerzService();

  // Create sponsorship purchase
  fastify.post(
    "/purchase",
    {
      preHandler: [
        verifyAuth,
        fileUploadPreHandler({
          folder: "documents",
          allowedTypes: ["image"],
          fieldLimits: {
            logo: 1,
          },
          maxFileSizeInMB: 5,
          schema: schemas.createSponsorshipPurchase,
        }),
      ],
    },
    async (request, reply) => {
      const {
        event_id,
        sponsorship_package_id,
        company_name,
        company_website,
        contact_person,
        contact_email,
        contact_phone,
        special_requests,
        billing_info,
      } = request.body;

      const user = request.user;
      const logo = request.upload?.files?.logo;

      const { purchase, invoice } =
        await eventService.createSponsorshipPurchase({
          event_id: Number(event_id),
          sponsorship_package_id: Number(sponsorship_package_id),
          user_id: user.id,
          billing_info,
          purchase_details: {
            company_name,
            company_website,
            contact_person,
            contact_email,
            contact_phone,
            special_requests,
            logo: logo
              ? {
                  url: logo.url,
                  filename: logo.filename,
                  size: logo.size,
                }
              : null,
          },
        });

      sendResponse(reply, httpStatus.CREATED, "Sponsorship purchase created", {
        purchase,
        invoice,
      });
    },
  );

  // Initiate payment for sponsorship
  fastify.post(
    "/:purchase_id/pay",
    {
      preHandler: [verifyAuth, validate(schemas.initiatePayment)],
    },
    async (request, reply) => {
      const { purchase_id } = request.params;
      const { payment_method } = request.body;
      const user = request.user;

      // Get purchase with invoice
      const purchase = await prisma.sponsorshipPurchase.findUnique({
        where: { id: Number(purchase_id) },
        include: {
          invoice: {
            include: {
              items: true,
            },
          },
          event: true,
          user: true,
        },
      });

      if (!purchase) {
        throw throwError(httpStatus.NOT_FOUND, "Purchase not found");
      }

      if (purchase.user_id !== user.id) {
        throw throwError(
          httpStatus.FORBIDDEN,
          "You are not authorized to pay for this purchase",
        );
      }

      if (purchase.status === SponsorshipStatus.CONFIRMED) {
        throw throwError(httpStatus.BAD_REQUEST, "Purchase already confirmed");
      }

      // Initiate SSLCommerz payment
      const paymentData = await sslCommerzService.initiatePayment({
        invoice: purchase.invoice,
        user: purchase.user,
        payment_method,
      });

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          invoice_id: purchase.invoice.id,
          user_id: user.id,
          amount: purchase.invoice.amount,
          currency: "BDT",
          status: "PENDING",
          payment_method,
          payment_provider: "sslcommerz",
          transaction_id: paymentData.sessionkey,
          metadata: {
            gateway_response: paymentData,
            purchase_type: "sponsorship",
            purchase_id: purchase.id,
          },
        },
      });

      sendResponse(reply, httpStatus.OK, "Payment initiated", {
        payment,
        gateway_url: paymentData.GatewayPageURL,
      });
    },
  );

  // Get user's sponsorship purchases
  fastify.get(
    "/my-purchases",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const user = request.user;
      const { status, page = 1, limit = 20 } = request.query;

      const where = { user_id: user.id };
      if (status) where.status = status;

      const [purchases, total] = await Promise.all([
        prisma.sponsorshipPurchase.findMany({
          where,
          skip: (page - 1) * limit,
          take: Number(limit),
          orderBy: { created_at: "desc" },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                slug: true,
                start_date: true,
                end_date: true,
                location: true,
              },
            },
            sponsorship_package: true,
            invoice: {
              include: {
                payments: true,
              },
            },
          },
        }),
        prisma.sponsorshipPurchase.count({ where }),
      ]);

      sendResponse(reply, httpStatus.OK, "Purchases retrieved", {
        purchases,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    },
  );

  // Get purchase details
  fastify.get(
    "/:purchase_id",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { purchase_id } = request.params;
      const user = request.user;

      const purchase = await prisma.sponsorshipPurchase.findUnique({
        where: { id: Number(purchase_id) },
        include: {
          event: true,
          sponsorship_package: true,
          invoice: {
            include: {
              items: true,
              payments: true,
            },
          },
        },
      });

      if (!purchase) {
        throw throwError(httpStatus.NOT_FOUND, "Purchase not found");
      }

      if (purchase.user_id !== user.id) {
        throw throwError(
          httpStatus.FORBIDDEN,
          "You are not authorized to view this purchase",
        );
      }

      sendResponse(
        reply,
        httpStatus.OK,
        "Purchase details retrieved",
        purchase,
      );
    },
  );

  // Cancel purchase (only if not paid)
  fastify.patch(
    "/:purchase_id/cancel",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { purchase_id } = request.params;
      const user = request.user;

      const purchase = await prisma.sponsorshipPurchase.findUnique({
        where: { id: Number(purchase_id) },
        include: { invoice: true },
      });

      if (!purchase) {
        throw throwError(httpStatus.NOT_FOUND, "Purchase not found");
      }

      if (purchase.user_id !== user.id) {
        throw throwError(
          httpStatus.FORBIDDEN,
          "You are not authorized to cancel this purchase",
        );
      }

      if (purchase.status === SponsorshipStatus.CONFIRMED) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Cannot cancel confirmed purchase. Please contact support for refund.",
        );
      }

      if (purchase.status === SponsorshipStatus.CANCELLED) {
        throw throwError(httpStatus.BAD_REQUEST, "Purchase already cancelled");
      }

      const updatedPurchase = await eventService.cancelSponsorshipPurchase(
        Number(purchase_id),
      );

      sendResponse(reply, httpStatus.OK, "Purchase cancelled", updatedPurchase);
    },
  );
}

export default userSponsorshipController;
