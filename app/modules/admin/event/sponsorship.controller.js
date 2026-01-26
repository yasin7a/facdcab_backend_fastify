// Admin Sponsorship Setup Controller
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

async function adminSponsorshipController(fastify, options) {
  // Save sponsorship setup and packages in one call
  fastify.post(
    "/setup-sponsorship",
    {
      preHandler: validate(adminSchemas.event.saveSponsorship),
    },
    async (request, reply) => {
      const { event_id, is_active, packages } = request.body;

      // Upsert sponsorship setup
      const setup = await prisma.sponsorshipSetup.upsert({
        where: { event_id: Number(event_id) },
        create: {
          event_id: Number(event_id),
          is_active: toBoolean(is_active),
        },
        update: {
          is_active: toBoolean(is_active),
        },
      });

      // Handle packages if provided
      let savedPackages = [];
      if (packages && packages.length > 0) {
        for (const pkg of packages) {
          const packageData = {
            sponsorship_setup_id: setup.id,
            package_name: pkg.package_name,
            is_premium: toBoolean(pkg.is_premium),
            price: pkg.price,
            max_slots: pkg.max_slots,
            benefits: pkg.benefits,
            description: pkg.description,
            is_active: toBoolean(pkg.is_active),
          };

          let savedPackage;
          if (pkg.id) {
            // Update existing package
            savedPackage = await prisma.sponsorshipPackage.update({
              where: { id: Number(pkg.id) },
              data: packageData,
            });
          } else {
            // Create new package
            savedPackage = await prisma.sponsorshipPackage.create({
              data: packageData,
            });
          }
          savedPackages.push(savedPackage);
        }
      }

      sendResponse(reply, httpStatus.OK, "Sponsorship saved", {
        setup,
        packages: savedPackages,
      });
    },
  );

  // Show sponsorship setup with packages
  fastify.get("/show/:event_id", async (request, reply) => {
    const { event_id } = request.params;

    const setup = await prisma.sponsorshipSetup.findUnique({
      where: { event_id: Number(event_id) },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            start_date: true,
            end_date: true,
          },
        },
        packages: {
          orderBy: {
            price: "asc",
          },
        },
      },
    });

    if (!setup) {
      throw throwError(
        httpStatus.NOT_FOUND,
        "Sponsorship setup not found for this event",
      );
    }

    sendResponse(reply, httpStatus.OK, "Sponsorship details", setup);
  });

  // Upload brochure for sponsorship setup
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

      const setup = await prisma.sponsorshipSetup.findUnique({
        where: { event_id: Number(event_id) },
      });

      if (!setup) {
        throw throwError(httpStatus.NOT_FOUND, "Sponsorship setup not found");
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

      const updatedSetup = await prisma.sponsorshipSetup.update({
        where: { event_id: Number(event_id) },
        data: updateData,
      });

      sendResponse(reply, httpStatus.OK, "Brochure updated", updatedSetup);
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
}

export default adminSponsorshipController;
