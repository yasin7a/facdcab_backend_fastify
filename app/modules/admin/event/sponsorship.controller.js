// Admin Sponsorship Setup Controller
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import { adminSchemas } from "../../../validators/validations.js";
import { fileUploadPreHandler } from "../../../middleware/fileUploader.js";

async function adminSponsorshipController(fastify, options) {
  // Create sponsorship setup for an event
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
        schema: adminSchemas.createSponsorshipSetup,
      }),
    },
    async (request, reply) => {
      const { event_id, is_active } = request.body;

      // Check if event exists
      const event = await prisma.event.findUnique({
        where: { id: Number(event_id) },
      });

      if (!event) {
        throw throwError(httpStatus.NOT_FOUND, "Event not found");
      }

      // Check if setup already exists
      const existingSetup = await prisma.sponsorshipSetup.findUnique({
        where: { event_id: Number(event_id) },
      });

      if (existingSetup) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Sponsorship setup already exists for this event",
        );
      }

      const brochure = request.upload?.files?.brochure;
      const termsDocument = request.upload?.files?.terms_document;

      const setup = await prisma.sponsorshipSetup.create({
        data: {
          event_id: Number(event_id),
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
        "Sponsorship setup created",
        setup,
      );
    },
  );

  // Update sponsorship setup
  fastify.patch(
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
        schema: adminSchemas.updateSponsorshipSetup,
      }),
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = { ...request.body };

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

      const setup = await prisma.sponsorshipSetup.update({
        where: { id: Number(id) },
        data: updates,
      });

      sendResponse(reply, httpStatus.OK, "Sponsorship setup updated", setup);
    },
  );

  // Add sponsorship package
  fastify.post(
    "/package",
    {
      preHandler: validate(adminSchemas.createSponsorshipPackage),
    },
    async (request, reply) => {
      const {
        sponsorship_setup_id,
        package_name,
        price,
        max_slots,
        benefits,
        description,
        is_active,
      } = request.body;

      const sponsorshipPackage = await prisma.sponsorshipPackage.create({
        data: {
          sponsorship_setup_id: Number(sponsorship_setup_id),
          package_name,
          price,
          max_slots,
          benefits,
          description,
          is_active: is_active !== undefined ? is_active : true,
        },
      });

      sendResponse(
        reply,
        httpStatus.CREATED,
        "Sponsorship package created",
        sponsorshipPackage,
      );
    },
  );

  // Update sponsorship package
  fastify.patch(
    "/package/:id",
    {
      preHandler: validate(adminSchemas.updateSponsorshipPackage),
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const sponsorshipPackage = await prisma.sponsorshipPackage.update({
        where: { id: Number(id) },
        data: updates,
      });

      sendResponse(
        reply,
        httpStatus.OK,
        "Sponsorship package updated",
        sponsorshipPackage,
      );
    },
  );

  // Delete sponsorship package
  fastify.delete("/package/:id", async (request, reply) => {
    const { id } = request.params;

    // Check if there are any purchases
    const purchaseCount = await prisma.sponsorshipPurchase.count({
      where: { sponsorship_package_id: Number(id) },
    });

    if (purchaseCount > 0) {
      throw throwError(
        httpStatus.BAD_REQUEST,
        "Cannot delete package with existing purchases",
      );
    }

    await prisma.sponsorshipPackage.delete({
      where: { id: Number(id) },
    });

    sendResponse(reply, httpStatus.OK, "Sponsorship package deleted");
  });

  // Get all sponsorship purchases for an event
  fastify.get("/purchases/:event_id", async (request, reply) => {
    const { event_id } = request.params;
    const { status, page = 1, limit = 20 } = request.query;

    const where = { event_id: Number(event_id) };
    if (status) where.status = status;

    const [purchases, total] = await Promise.all([
      prisma.sponsorshipPurchase.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { created_at: "desc" },
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

    sendResponse(reply, httpStatus.OK, "Sponsorship purchases retrieved", {
      purchases,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  });

  // Update purchase status
  fastify.patch("/purchases/:id/status", async (request, reply) => {
    const { id } = request.params;
    const { status } = request.body;

    const purchase = await prisma.sponsorshipPurchase.update({
      where: { id: Number(id) },
      data: { status },
    });

    sendResponse(reply, httpStatus.OK, "Purchase status updated", purchase);
  });
}

export default adminSponsorshipController;
