// User Event Controller - Browse and view events
import { prisma } from "../../../lib/prisma.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { EventStatus } from "../../../utilities/constant.js";

async function userEventController(fastify, options) {
  // Get all published events
  fastify.get("/list", async (request, reply) => {
    const { page = 1, limit = 20, upcoming } = request.query;

    const where = {
      status: EventStatus.PUBLISHED,
      is_active: true,
    };

    // Filter upcoming events
    if (upcoming === "true") {
      where.start_date = {
        gte: new Date(),
      };
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { start_date: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          slug: true,
          start_date: true,
          end_date: true,
          location: true,
          status: true,
          created_at: true,
        },
      }),
      prisma.event.count({ where }),
    ]);

    return sendResponse(reply, httpStatus.OK, "Events retrieved", {
      events,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  });

  // Get event by slug or ID with stall and sponsorship details
  fastify.get("/:identifier", async (request, reply) => {
    const { identifier } = request.params;

    // Check if identifier is numeric (ID) or string (slug)
    const isId = !isNaN(identifier);
    const where = isId ? { id: Number(identifier) } : { slug: identifier };

    const event = await prisma.event.findUnique({
      where,
      include: {
        stall_booking_setup: {
          where: { is_active: true },
          include: {
            categories: {
              where: { is_active: true },
              orderBy: { price: "asc" },
            },
          },
        },
        sponsorship_setup: {
          where: { is_active: true },
          include: {
            packages: {
              where: { is_active: true },
              orderBy: { price: "desc" },
            },
          },
        },
      },
    });

    if (!event) {
      throw throwError(httpStatus.NOT_FOUND, "Event not found");
    }

    if (
      event.status !== EventStatus.PUBLISHED &&
      event.status !== EventStatus.ONGOING
    ) {
      throw throwError(httpStatus.FORBIDDEN, "Event is not available");
    }

    return sendResponse(reply, httpStatus.OK, "Event details retrieved", event);
  });

  // Get available stall categories for an event
  fastify.get("/:event_id/stalls", async (request, reply) => {
    const { event_id } = request.params;

    const event = await prisma.event.findUnique({
      where: { id: Number(event_id) },
      include: {
        stall_booking_setup: {
          where: { is_active: true },
          include: {
            categories: {
              where: { is_active: true },
            },
          },
        },
      },
    });

    if (!event) {
      throw throwError(httpStatus.NOT_FOUND, "Event not found");
    }

    if (!event.stall_booking_setup) {
      throw throwError(
        httpStatus.NOT_FOUND,
        "Stall booking not available for this event",
      );
    }

    // Check if booking deadline has passed
    const isPastDeadline =
      new Date() > event.stall_booking_setup.booking_deadline;

    const categories = event.stall_booking_setup.categories.map((cat) => ({
      ...cat,
      available_seats: cat.max_seats - cat.booked_seats,
      is_available: cat.max_seats > cat.booked_seats && !isPastDeadline,
    }));

    return sendResponse(reply, httpStatus.OK, "Stall categories retrieved", {
      categories,
      booking_deadline: event.stall_booking_setup.booking_deadline,
      is_past_deadline: isPastDeadline,
    });
  });

  // Get available sponsorship packages for an event
  fastify.get("/:event_id/sponsorships", async (request, reply) => {
    const { event_id } = request.params;

    const event = await prisma.event.findUnique({
      where: { id: Number(event_id) },
      include: {
        sponsorship_setup: {
          where: { is_active: true },
          include: {
            packages: {
              where: { is_active: true },
            },
          },
        },
      },
    });

    if (!event) {
      throw throwError(httpStatus.NOT_FOUND, "Event not found");
    }

    if (!event.sponsorship_setup) {
      throw throwError(
        httpStatus.NOT_FOUND,
        "Sponsorships not available for this event",
      );
    }

    const packages = event.sponsorship_setup.packages.map((pkg) => ({
      ...pkg,
      available_slots: pkg.max_slots - pkg.booked_slots,
      is_available: pkg.max_slots > pkg.booked_slots,
    }));

    return sendResponse(reply, httpStatus.OK, "Sponsorship packages retrieved", {
      packages,
    });
  });
}

export default userEventController;
