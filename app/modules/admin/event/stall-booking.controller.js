// Admin Stall Booking Setup Controller
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { adminSchemas } from "../../../validators/validations.js";
import { fileUploadPreHandler } from "../../../middleware/fileUploader.js";
import offsetPagination from "../../../utilities/offsetPagination.js";

async function adminStallBookingController(fastify, options) {
  // Create stall booking setup for an event
  fastify.post(
    "/setup",
    {
      preHandler: fileUploadPreHandler({
        folder: "documents",
        allowedTypes: ["docs"],
        fieldLimits: {
          brochure: 1,
          terms_document: 1,
        },
        maxFileSizeInMB: 10,
        schema: adminSchemas.event.createStallBookingSetup,
      }),
    },
    async (request, reply) => {
      const { event_id, booking_deadline, is_active } = request.body;

      // Check if event exists
      const event = await prisma.event.findUnique({
        where: { id: Number(event_id) },
      });

      if (!event) {
        throw throwError(httpStatus.NOT_FOUND, "Event not found");
      }

      // Check if setup already exists
      const existingSetup = await prisma.stallBookingSetup.findUnique({
        where: { event_id: Number(event_id) },
      });

      if (existingSetup) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Stall booking setup already exists for this event",
        );
      }

      const brochure = request.upload?.files?.brochure;
      const termsDocument = request.upload?.files?.terms_document;

      const setup = await prisma.stallBookingSetup.create({
        data: {
          event_id: Number(event_id),
          booking_deadline: new Date(booking_deadline),
          is_active: is_active !== undefined ? is_active : true,
          brochure: brochure
            ? {
                url: brochure.url,
                filename: brochure.filename,
                size: brochure.size,
              }
            : null,
          terms_document: termsDocument
            ? {
                url: termsDocument.url,
                filename: termsDocument.filename,
                size: termsDocument.size,
              }
            : null,
        },
      });

      sendResponse(
        reply,
        httpStatus.CREATED,
        "Stall booking setup created",
        setup,
      );
    },
  );

  // Update stall booking setup
  fastify.put(
    "/setup/:id",
    {
      preHandler: fileUploadPreHandler({
        folder: "documents",
        allowedTypes: ["docs"],
        fieldLimits: {
          brochure: 1,
          terms_document: 1,
        },
        maxFileSizeInMB: 10,
        schema: adminSchemas.event.updateStallBookingSetup,
      }),
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = { ...request.body };

      if (updates.booking_deadline) {
        updates.booking_deadline = new Date(updates.booking_deadline);
      }

      const brochure = request.upload?.files?.brochure;
      const termsDocument = request.upload?.files?.terms_document;

      if (brochure) {
        updates.brochure = {
          url: brochure.url,
          filename: brochure.filename,
          size: brochure.size,
        };
      }

      if (termsDocument) {
        updates.terms_document = {
          url: termsDocument.url,
          filename: termsDocument.filename,
          size: termsDocument.size,
        };
      }

      const setup = await prisma.stallBookingSetup.update({
        where: { id: Number(id) },
        data: updates,
      });

      sendResponse(reply, httpStatus.OK, "Stall booking setup updated", setup);
    },
  );

  // Add stall category to setup
  fastify.post(
    "/category",
    {
      preHandler: validate(adminSchemas.event.createStallCategory),
    },
    async (request, reply) => {
      const {
        stall_booking_setup_id,
        category_name,
        size,
        price,
        max_seats,
        description,
        is_active,
      } = request.body;

      const category = await prisma.stallCategory.create({
        data: {
          stall_booking_setup_id: Number(stall_booking_setup_id),
          category_name,
          size,
          price,
          max_seats,
          description,
          is_active: is_active !== undefined ? is_active : true,
        },
      });

      sendResponse(
        reply,
        httpStatus.CREATED,
        "Stall category created",
        category,
      );
    },
  );

  // Update stall category
  fastify.put(
    "/category/:id",
    {
      preHandler: validate(adminSchemas.event.updateStallCategory),
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const category = await prisma.stallCategory.update({
        where: { id: Number(id) },
        data: updates,
      });

      sendResponse(reply, httpStatus.OK, "Stall category updated", category);
    },
  );

  // Delete stall category
  fastify.delete("/category/:id", async (request, reply) => {
    const { id } = request.params;

    // Check if there are any bookings
    const bookingCount = await prisma.stallBookingPurchase.count({
      where: { stall_category_id: Number(id) },
    });

    if (bookingCount > 0) {
      throw throwError(
        httpStatus.BAD_REQUEST,
        "Cannot delete category with existing bookings",
      );
    }

    await prisma.stallCategory.delete({
      where: { id: Number(id) },
    });

    sendResponse(reply, httpStatus.OK, "Stall category deleted");
  });

  // Get all bookings for an event
  fastify.get("/bookings/:event_id", async (request, reply) => {
    const { event_id } = request.params;
    const { status, page, limit } = request.query;

    const where = { event_id: Number(event_id) };
    if (status) where.status = status;

    const data = await offsetPagination({
      model: prisma.stallBookingPurchase,
      where,
      page,
      limit,
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
          },
        },
        stall_category: true,
        invoice: {
          include: {
            payments: true,
          },
        },
      },
    });

    return sendResponse(reply, httpStatus.OK, "Stall bookings retrieved", data);
  });

  // Update booking status
  fastify.put("/bookings/:id/status", async (request, reply) => {
    const { id } = request.params;
    const { status } = request.body;

    const booking = await prisma.stallBookingPurchase.update({
      where: { id: Number(id) },
      data: { status },
    });

    sendResponse(reply, httpStatus.OK, "Booking status updated", booking);
  });
}

export default adminStallBookingController;
