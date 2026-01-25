// Admin Event Management Controller
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { adminSchemas } from "../../../validators/validations.js";
import slugify from "../../../utilities/slugify.js";
import { EventStatus } from "../../../utilities/constant.js";
import EventService from "../../../services/event.service.js";

async function adminEventController(fastify, options) {
  const eventService = new EventService();

  // List all events
  fastify.get("/list", async (request, reply) => {
    const { status, page = 1, limit = 20 } = request.query;

    const where = {};
    if (status) where.status = status;

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { created_at: "desc" },
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
          _count: {
            select: {
              stall_bookings: true,
              sponsorship_purchases: true,
            },
          },
        },
      }),
      prisma.event.count({ where }),
    ]);

    sendResponse(reply, httpStatus.OK, "Events retrieved", {
      events,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  });

  // Get event details
  fastify.get("/:id", async (request, reply) => {
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
        stall_bookings: {
          include: {
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
              },
            },
            invoice: true,
          },
        },
        sponsorship_purchases: {
          include: {
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
              },
            },
            invoice: true,
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
      preHandler: validate(adminSchemas.event.createEvent),
    },
    async (request, reply) => {
      const { title, description, start_date, end_date, location, status } =
        request.body;

      const slug = slugify(title);

      // Check if slug exists
      const existingEvent = await prisma.event.findUnique({
        where: { slug },
      });

      if (existingEvent) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Event with this title already exists",
        );
      }

      const event = await prisma.event.create({
        data: {
          title,
          description,
          slug,
          start_date: new Date(start_date),
          end_date: new Date(end_date),
          location,
          status: status || EventStatus.DRAFT,
        },
      });

      sendResponse(reply, httpStatus.CREATED, "Event created", event);
    },
  );

  // Update event
  fastify.patch(
    "/:id",
    {
      preHandler: validate(adminSchemas.event.updateEvent),
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      if (updates.title) {
        updates.slug = slugify(updates.title);
      }

      if (updates.start_date) {
        updates.start_date = new Date(updates.start_date);
      }

      if (updates.end_date) {
        updates.end_date = new Date(updates.end_date);
      }

      const event = await prisma.event.update({
        where: { id: Number(id) },
        data: updates,
      });

      sendResponse(reply, httpStatus.OK, "Event updated", event);
    },
  );

  // Delete event
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params;

    await prisma.event.delete({
      where: { id: Number(id) },
    });

    sendResponse(reply, httpStatus.OK, "Event deleted");
  });

  // Get event statistics
  fastify.get("/:id/statistics", async (request, reply) => {
    const { id } = request.params;

    const event = await prisma.event.findUnique({
      where: { id: Number(id) },
    });

    if (!event) {
      throw throwError(httpStatus.NOT_FOUND, "Event not found");
    }

    const stats = await eventService.getEventStats(Number(id));

    sendResponse(reply, httpStatus.OK, "Statistics retrieved", stats);
  });
}

export default adminEventController;
