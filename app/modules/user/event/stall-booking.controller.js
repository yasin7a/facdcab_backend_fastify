// User Stall Booking Controller - Purchase stalls
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import verifyAuth from "../../../middleware/verifyAuth.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { schemas } from "../../../validators/validations.js";
import EventService from "../../../services/event.service.js";
import SSLCommerzService from "../../../services/sslcommerz.service.js";
import { StallBookingPurchaseStatus } from "../../../utilities/constant.js";

async function userStallBookingController(fastify, options) {
  const eventService = new EventService();
  const sslCommerzService = new SSLCommerzService();

  // Create stall booking
  fastify.post(
    "/book",
    {
      preHandler: [verifyAuth, validate(schemas.createStallBooking)],
    },
    async (request, reply) => {
      const {
        event_id,
        stall_category_id,
        quantity,
        company_name,
        contact_person,
        contact_email,
        contact_phone,
        special_requests,
        billing_info,
      } = request.body;

      const user = request.user;

      const { booking, invoice } = await eventService.createStallBooking({
        event_id: Number(event_id),
        stall_category_id: Number(stall_category_id),
        user_id: user.id,
        quantity,
        billing_info,
        booking_details: {
          company_name,
          contact_person,
          contact_email,
          contact_phone,
          special_requests,
        },
      });

      sendResponse(reply, httpStatus.CREATED, "Stall booking created", {
        booking,
        invoice,
      });
    },
  );

  // Initiate payment for stall booking
  fastify.post(
    "/:booking_id/pay",
    {
      preHandler: [verifyAuth, validate(schemas.initiatePayment)],
    },
    async (request, reply) => {
      const { booking_id } = request.params;
      const { payment_method } = request.body;
      const user = request.user;

      // Get booking with invoice
      const booking = await prisma.stallBookingPurchase.findUnique({
        where: { id: Number(booking_id) },
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

      if (!booking) {
        throw throwError(httpStatus.NOT_FOUND, "Booking not found");
      }

      if (booking.user_id !== user.id) {
        throw throwError(
          httpStatus.FORBIDDEN,
          "You are not authorized to pay for this booking",
        );
      }

      if (booking.status === StallBookingPurchaseStatus.CONFIRMED) {
        throw throwError(httpStatus.BAD_REQUEST, "Booking already confirmed");
      }

      // Initiate SSLCommerz payment
      const paymentData = await sslCommerzService.initiatePayment({
        invoice: booking.invoice,
        user: booking.user,
        payment_method,
      });

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          invoice_id: booking.invoice.id,
          user_id: user.id,
          amount: booking.invoice.amount,
          currency: "BDT",
          status: "PENDING",
          payment_method,
          payment_provider: "sslcommerz",
          transaction_id: paymentData.sessionkey,
          metadata: {
            gateway_response: paymentData,
            booking_type: "stall",
            booking_id: booking.id,
          },
        },
      });

      sendResponse(reply, httpStatus.OK, "Payment initiated", {
        payment,
        gateway_url: paymentData.GatewayPageURL,
      });
    },
  );

  // Get user's stall bookings
  fastify.get(
    "/my-bookings",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const user = request.user;
      const { status, page = 1, limit = 20 } = request.query;

      const where = { user_id: user.id };
      if (status) where.status = status;

      const [bookings, total] = await Promise.all([
        prisma.stallBookingPurchase.findMany({
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
            stall_category: true,
            invoice: {
              include: {
                payments: true,
              },
            },
          },
        }),
        prisma.stallBookingPurchase.count({ where }),
      ]);

      sendResponse(reply, httpStatus.OK, "Bookings retrieved", {
        bookings,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    },
  );

  // Get booking details
  fastify.get(
    "/:booking_id",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { booking_id } = request.params;
      const user = request.user;

      const booking = await prisma.stallBookingPurchase.findUnique({
        where: { id: Number(booking_id) },
        include: {
          event: true,
          stall_category: true,
          invoice: {
            include: {
              items: true,
              payments: true,
            },
          },
        },
      });

      if (!booking) {
        throw throwError(httpStatus.NOT_FOUND, "Booking not found");
      }

      if (booking.user_id !== user.id) {
        throw throwError(
          httpStatus.FORBIDDEN,
          "You are not authorized to view this booking",
        );
      }

      sendResponse(reply, httpStatus.OK, "Booking details retrieved", booking);
    },
  );

  // Cancel booking (only if not paid)
  fastify.patch(
    "/:booking_id/cancel",
    {
      preHandler: verifyAuth,
    },
    async (request, reply) => {
      const { booking_id } = request.params;
      const user = request.user;

      const booking = await prisma.stallBookingPurchase.findUnique({
        where: { id: Number(booking_id) },
        include: { invoice: true },
      });

      if (!booking) {
        throw throwError(httpStatus.NOT_FOUND, "Booking not found");
      }

      if (booking.user_id !== user.id) {
        throw throwError(
          httpStatus.FORBIDDEN,
          "You are not authorized to cancel this booking",
        );
      }

      if (booking.status === StallBookingPurchaseStatus.CONFIRMED) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Cannot cancel confirmed booking. Please contact support for refund.",
        );
      }

      if (booking.status === StallBookingPurchaseStatus.CANCELLED) {
        throw throwError(httpStatus.BAD_REQUEST, "Booking already cancelled");
      }

      const updatedBooking = await eventService.cancelStallBooking(
        Number(booking_id),
      );

      sendResponse(reply, httpStatus.OK, "Booking cancelled", updatedBooking);
    },
  );
}

export default userStallBookingController;
