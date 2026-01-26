// Admin Stall Booking Setup Controller
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { adminSchemas } from "../../../validators/validations.js";
import {
  fileUploadPreHandler,
  deleteFiles,
} from "../../../middleware/fileUploader.js";
import offsetPagination from "../../../utilities/offsetPagination.js";
import toBoolean from "../../../utilities/toBoolean.js";

async function adminStallBookingController(fastify, options) {
  // Save stall booking setup and categories in one call
  fastify.post(
    "/setup-stall-booking",
    {
      preHandler: validate(adminSchemas.event.saveStallBooking),
    },
    async (request, reply) => {
      const { event_id, booking_deadline, is_active, categories } =
        request.body;

      // Upsert stall booking setup
      const setup = await prisma.stallBookingSetup.upsert({
        where: { event_id: Number(event_id) },
        create: {
          event_id: Number(event_id),
          booking_deadline: booking_deadline
            ? new Date(booking_deadline)
            : null,
          is_active: toBoolean(is_active),
        },
        update: {
          booking_deadline: booking_deadline
            ? new Date(booking_deadline)
            : null,
          is_active: toBoolean(is_active),
        },
      });

      // Handle categories if provided
      let savedCategories = [];
      if (categories && categories.length > 0) {
        for (const cat of categories) {
          const categoryData = {
            stall_booking_setup_id: setup.id,
            category_name: cat.category_name,
            is_premium: toBoolean(cat.is_premium),
            size: cat.size,
            price: cat.price,
            max_seats: cat.max_seats,
            features: cat.features,
            is_active: toBoolean(cat.is_active),
          };

          let savedCategory;
          if (cat.id) {
            // Update existing category
            savedCategory = await prisma.stallCategory.update({
              where: { id: Number(cat.id) },
              data: categoryData,
            });
          } else {
            // Create new category
            savedCategory = await prisma.stallCategory.create({
              data: categoryData,
            });
          }
          savedCategories.push(savedCategory);
        }
      }

      sendResponse(reply, httpStatus.OK, "Stall booking saved", {
        setup,
        categories: savedCategories,
      });
    },
  );

  // Upload brochure for stall booking setup
  fastify.post(
    "/brochure",
    {
      preHandler: fileUploadPreHandler({
        folder: "documents",
        allowedTypes: ["docs"],
        fieldLimits: {
          brochure: 1,
        },
        maxFileSizeInMB: 10,
        schema: adminSchemas.event.uploadBrochure,
      }),
    },
    async (request, reply) => {
      const { event_id, brochure } = request.upload?.fields || request.body;

      const setup = await prisma.stallBookingSetup.findUnique({
        where: { event_id: Number(event_id) },
      });

      if (!setup) {
        throw throwError(httpStatus.NOT_FOUND, "Stall booking setup not found");
      }

      let updateData = {};

      // Check if user wants to remove brochure
      if (brochure === "null" && !request.upload?.files?.brochure) {
        if (setup.brochure?.path) {
          await deleteFiles(setup.brochure.path);
        }
        updateData.brochure = null;
      }
      // Handle new brochure upload
      else if (request.upload?.files?.brochure) {
        const newBrochure = request.upload.files.brochure;

        // Delete old brochure if exists
        if (setup.brochure?.path) {
          await deleteFiles(setup.brochure.path);
        }

        updateData.brochure = newBrochure;
      } else {
        throw throwError(httpStatus.BAD_REQUEST, "Brochure file is required");
      }

      const updatedSetup = await prisma.stallBookingSetup.update({
        where: { event_id: Number(event_id) },
        data: updateData,
      });

      sendResponse(reply, httpStatus.OK, "Brochure updated", updatedSetup);
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
}

export default adminStallBookingController;
