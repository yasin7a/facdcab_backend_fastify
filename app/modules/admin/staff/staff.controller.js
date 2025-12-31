import bcrypt from "bcrypt";
import { prisma } from "../../../lib/prisma.js";
import {
  deleteFiles,
  fileUploadPreHandler,
} from "../../../middleware/fileUploader.js";
import validate from "../../../middleware/validate.js";
import httpStatus from "../../../utilities/httpStatus.js";
import offsetPagination from "../../../utilities/offsetPagination.js";
import sendResponse from "../../../utilities/sendResponse.js";
import generateUniqueSlug from "../../../utilities/slugify.js";
import throwError from "../../../utilities/throwError.js";
import { adminSchemas } from "../../../validators/validations.js";

async function adminStaffController(fastify, options) {
  fastify.get("/list", async (request, reply) => {
    const { search, page, limit } = request.query;

    const where = {};

    // Add search functionality for first name and last name
    if (search && search.trim()) {
      const searchTerms = search.trim().split(/\s+/);
      where.OR = searchTerms.flatMap((term) => [
        {
          first_name: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          last_name: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: term,
            mode: "insensitive",
          },
        },
      ]);
    }

    const select = {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      avatar: true,
      slug: true,
      is_active: true,
      dob: true,
      created_at: true,
      updated_at: true,
      document_categories: {
        select: {
          id: true,
          name: true,
        },
      },
    };

    const data = await offsetPagination({
      model: prisma.adminUser,
      where,
      page,
      limit,
      select,
    });

    return sendResponse(reply, httpStatus.OK, "Staff List", data);
  });

  fastify.get("/show/:slug", async (request, reply) => {
    const staff = await prisma.adminUser.findFirst({
      where: {
        slug: request.params.slug,
      },
      omit: {
        password: true,
      },
      include: {
        document_categories: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!staff) {
      throw throwError(httpStatus.NOT_FOUND, "Staff not found");
    }

    return sendResponse(reply, httpStatus.OK, "Staff Details", staff);
  });

  fastify.post(
    "/create",
    {
      preHandler: fileUploadPreHandler({
        folder: "admin_users",
        allowedTypes: ["image"],
        fieldLimits: { avatar: 1 },
        maxFileSizeInMB: 5,
        schema: adminSchemas.createStaff,
      }),
    },
    async (request, reply) => {
      const staffData = request.upload?.fields || request.body;

      // Trim and normalize email
      if (staffData.email) {
        staffData.email = staffData.email.trim().toLowerCase();
      }

      // Parse date if provided
      staffData.dob = staffData.dob ? new Date(staffData.dob) : null;

      // Handle avatar upload
      if (request.upload?.files?.avatar) {
        staffData.avatar = request.upload.files.avatar;
      }

      // Hash password
      if (staffData.password) {
        staffData.password = await bcrypt.hash(staffData.password, 5);
      }

      // Generate unique slug
      if (staffData.first_name) {
        staffData.slug = await generateUniqueSlug(
          staffData.first_name,
          null,
          prisma.adminUser
        );
      }

      // Handle category assignment
      const document_categories = staffData.document_categories;
      delete staffData.document_categories;

      const data = await prisma.adminUser.create({
        data: {
          ...staffData,
          ...(document_categories && document_categories.length > 0
            ? {
                document_categories: {
                  connect: document_categories.map((id) => ({ id })),
                },
              }
            : {}),
        },
        omit: {
          password: true,
        },
        include: {
          document_categories: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "User Created Successfully",
        data
      );
    }
  );

  // Update staff
  fastify.put(
    "/update/:id",
    {
      preHandler: fileUploadPreHandler({
        folder: "admin_users",
        allowedTypes: ["image"],
        fieldLimits: { avatar: 1 },
        maxFileSizeInMB: 5,
        schema: (request) =>
          adminSchemas.updateStaff({ staffId: parseInt(request.params.id) }),
      }),
    },
    async (request, reply) => {
      const staffData = request.upload?.fields || request.body;
      const staffId = parseInt(request.params.id);

      // Trim and normalize email if provided
      if (staffData.email) {
        staffData.email = staffData.email.trim().toLowerCase();
      }

      // Get current staff data for operations that need it
      const currentStaff = await prisma.adminUser.findFirst({
        where: { id: staffId },
      });

      // Parse date if provided
      staffData.dob = staffData.dob ? new Date(staffData.dob) : null;

      // Handle avatar upload
      if (request.upload?.files?.avatar) {
        const avatar = request.upload.files.avatar;

        // Delete old avatar if exists
        if (currentStaff.avatar?.path) {
          await deleteFiles(currentStaff.avatar.path);
        }

        staffData.avatar = avatar;
      }

      // Hash password if provided
      if (staffData.password) {
        staffData.password = await bcrypt.hash(staffData.password, 5);
      } else {
        delete staffData.password;
      }

      // Generate unique slug if first_name changes
      if (
        staffData.first_name &&
        staffData.first_name !== currentStaff.first_name
      ) {
        staffData.slug = await generateUniqueSlug(
          staffData.first_name,
          staffId,
          prisma.adminUser
        );
      }

      // Handle category assignment
      const document_categories = staffData.document_categories;
      delete staffData.document_categories;

      const result = await prisma.adminUser.update({
        where: { id: staffId },
        data: {
          ...staffData,
          ...(document_categories !== undefined
            ? {
                document_categories: {
                  set: document_categories.map((id) => ({ id })),
                },
              }
            : {}),
        },
        omit: {
          password: true,
        },
        include: {
          document_categories: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "User Updated Successfully",
        result
      );
    }
  );

  // Update staff status
  fastify.put(
    "/status/:id",
    {
      preHandler: validate(adminSchemas.updateStaffStatus),
    },
    async (request, reply) => {
      const { id } = request.params;
      const { is_active } = request.body;

      // Check if staff exists
      const staff = await prisma.adminUser.findFirst({
        where: {
          id: parseInt(id),
        },
      });

      if (!staff) {
        throw throwError(httpStatus.NOT_FOUND, "User not found");
      }

      const data = await prisma.adminUser.update({
        where: { id: parseInt(id) },
        data: { is_active },
        select: {
          is_active: true,
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "User Status Updated Successfully",
        data
      );
    }
  );

  // Delete staff
  fastify.delete("/delete/:id", async (request, reply) => {
    const staffId = parseInt(request.params.id);

    // Check if staff exists
    const staffRecord = await prisma.adminUser.findFirst({
      where: {
        id: staffId,
      },
    });

    if (!staffRecord) {
      throw throwError(httpStatus.NOT_FOUND, "User not found");
    }

    // Delete the avatar file if it exists
    if (staffRecord.avatar?.path) {
      await deleteFiles(staffRecord.avatar.path);
    }

    await prisma.adminUser.delete({
      where: { id: staffId },
      omit: {
        password: true,
      },
    });

    return sendResponse(reply, httpStatus.OK, "User Deleted Successfully");
  });
}

export default adminStaffController;
