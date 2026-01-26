// Admin Event Management Controller
import { prisma } from "../../../lib/prisma.js";
import {
  deleteFiles,
  fileUploadPreHandler,
} from "../../../middleware/fileUploader.js";
import validate from "../../../middleware/validate.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { adminSchemas } from "../../../validators/validations.js";
import generateUniqueSlug from "../../../utilities/slugify.js";
import { EventStatus } from "../../../utilities/constant.js";
import EventService from "../../../services/event.service.js";
import offsetPagination from "../../../utilities/offsetPagination.js";

async function adminEventController(fastify, options) {
  const eventService = new EventService();

  // List all events
  fastify.get("/list", async (request, reply) => {
    const { status, page, limit } = request.query;

    const where = {};
    if (status) where.status = status;

    const data = await offsetPagination({
      model: prisma.event,
      where,
      page,
      limit,
    });

    return sendResponse(reply, httpStatus.OK, "Events retrieved", data);
  });

  // Get event details
  fastify.get("/show/:id", async (request, reply) => {
    const { id } = request.params;

    const event = await prisma.event.findUnique({
      where: { id: Number(id) },
      include: {
        stall_booking_setup: {
          include: {
            categories: true,
          },
        },
        sponsorship_setup: {
          include: {
            packages: true,
          },
        },
      },
    });

    if (!event) {
      throw throwError(httpStatus.NOT_FOUND, "Event not found");
    }

    const stats = await eventService.getEventStats(event.id);

    sendResponse(reply, httpStatus.OK, "Event details retrieved", {
      event,
      stats,
    });
  });

  // Create event
  fastify.post(
    "/create",
    {
      preHandler: fileUploadPreHandler({
        folder: "events",
        allowedTypes: ["image"],
        fieldLimits: { banner: 1 },
        maxFileSizeInMB: 5,
        schema: adminSchemas.event.createEvent,
      }),
    },
    async (request, reply) => {
      const eventData = request.upload?.fields || request.body;

      // Generate unique slug from name
      eventData.slug = await generateUniqueSlug(
        eventData.name,
        null,
        prisma.event,
      );

      // Parse dates
      if (eventData.start_date) {
        eventData.start_date = new Date(eventData.start_date);
      }
      if (eventData.end_date) {
        eventData.end_date = new Date(eventData.end_date);
      }
      if (eventData.registration_deadline) {
        eventData.registration_deadline = new Date(
          eventData.registration_deadline,
        );
      }

      // Handle banner upload
      if (request.upload?.files?.banner) {
        eventData.banner = request.upload.files.banner;
      } else {
        delete eventData.banner;
      }

      // Set default status if not provided
      if (!eventData.status) {
        eventData.status = EventStatus.DRAFT;
      }

      const event = await prisma.event.create({
        data: eventData,
      });

      return sendResponse(reply, httpStatus.CREATED, "Event created", event);
    },
  );

  // Update event
  fastify.put(
    "/update/:id",
    {
      preHandler: fileUploadPreHandler({
        folder: "events",
        allowedTypes: ["image"],
        fieldLimits: { banner: 1 },
        maxFileSizeInMB: 5,
        schema: adminSchemas.event.updateEvent,
      }),
    },
    async (request, reply) => {
      const { id } = request.params;
      const eventData = request.upload?.fields || request.body;
      const eventId = Number(id);

      // Get current event data
      const currentEvent = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!currentEvent) {
        throw throwError(httpStatus.NOT_FOUND, "Event not found");
      }

      // Generate unique slug if name changes
      if (eventData.name && eventData.name !== currentEvent.name) {
        const newSlug = await generateUniqueSlug(
          eventData.name,
          eventId,
          prisma.event,
        );

        // Save old slug to old_slugs array if slug is changing
        if (
          newSlug !== currentEvent.slug &&
          !currentEvent.old_slugs.includes(currentEvent.slug)
        ) {
          // Check if old slug conflicts with any existing current slugs or old_slugs
          const conflictingEvent = await prisma.event.findFirst({
            where: {
              AND: [
                { id: { not: eventId } },
                {
                  OR: [
                    { slug: currentEvent.slug },
                    { old_slugs: { has: currentEvent.slug } },
                  ],
                },
              ],
            },
          });

          // Only save to old_slugs if no conflict
          if (!conflictingEvent) {
            eventData.old_slugs = {
              push: currentEvent.slug,
            };
          }
        }

        eventData.slug = newSlug;
      }

      // Parse dates if provided
      if (eventData.start_date) {
        eventData.start_date = new Date(eventData.start_date);
      }
      if (eventData.end_date) {
        eventData.end_date = new Date(eventData.end_date);
      }
      if (eventData.registration_deadline) {
        eventData.registration_deadline = new Date(
          eventData.registration_deadline,
        );
      }

      // Check if user wants to remove banner
      if (eventData.banner === "null" && !request.upload?.files?.banner) {
        if (currentEvent.banner?.path) {
          await deleteFiles(currentEvent.banner.path);
        }
        eventData.banner = null;
      }
      // Handle new banner upload
      else if (request.upload?.files?.banner) {
        const banner = request.upload.files.banner;

        // Delete old banner if exists
        if (currentEvent.banner?.path) {
          await deleteFiles(currentEvent.banner.path);
        }

        eventData.banner = banner;
      }
      // If banner not sent, don't update it (keep existing)
      else {
        delete eventData.banner;
      }

      const event = await prisma.event.update({
        where: { id: eventId },
        data: eventData,
      });

      return sendResponse(reply, httpStatus.OK, "Event updated", event);
    },
  );

  // Delete event
  fastify.delete("/delete/:id", async (request, reply) => {
    const { id } = request.params;
    const eventId = Number(id);

    // Get event with all related data
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        stall_booking_setup: {
          include: {
            categories: true,
          },
        },
        sponsorship_setup: {
          include: {
            packages: true,
          },
        },
      },
    });

    if (!event) {
      throw throwError(httpStatus.NOT_FOUND, "Event not found");
    }

    // Delete stall booking brochure if exists
    if (event.stall_booking_setup?.brochure?.path) {
      await deleteFiles(event.stall_booking_setup.brochure.path);
    }

    // Delete sponsorship brochure if exists
    if (event.sponsorship_setup?.brochure?.path) {
      await deleteFiles(event.sponsorship_setup.brochure.path);
    }

    // Delete event banner if exists
    if (event.banner?.path) {
      await deleteFiles(event.banner.path);
    }

    // Delete stall booking categories
    if (event.stall_booking_setup) {
      await prisma.stallBookingCategory.deleteMany({
        where: { stall_booking_setup_id: event.stall_booking_setup.id },
      });

      // Delete stall booking setup
      await prisma.stallBookingSetup.delete({
        where: { id: event.stall_booking_setup.id },
      });
    }

    // Delete sponsorship packages
    if (event.sponsorship_setup) {
      await prisma.sponsorshipPackage.deleteMany({
        where: { sponsorship_setup_id: event.sponsorship_setup.id },
      });

      // Delete sponsorship setup
      await prisma.sponsorshipSetup.delete({
        where: { id: event.sponsorship_setup.id },
      });
    }

    // Finally delete the event
    await prisma.event.delete({
      where: { id: eventId },
    });

    return sendResponse(
      reply,
      httpStatus.OK,
      "Event and all related data deleted",
    );
  });

  // Get event statistics
  fastify.get("/statistics/:id", async (request, reply) => {
    const { id } = request.params;

    const event = await prisma.event.findUnique({
      where: { id: Number(id) },
    });

    if (!event) {
      throw throwError(httpStatus.NOT_FOUND, "Event not found");
    }

    const stats = await eventService.getEventStats(Number(id));

    return sendResponse(reply, httpStatus.OK, "Statistics retrieved", stats);
  });
}

export default adminEventController;
