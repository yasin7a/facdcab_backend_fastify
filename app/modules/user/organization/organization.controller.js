import { prisma } from "../../../lib/prisma.js";
import {
  deleteFiles,
  fileUploadPreHandler,
} from "../../../middleware/fileUploader.js";
import validate from "../../../middleware/validate.js";
import httpStatus from "../../../utilities/httpStatus.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import { schemas } from "../../../validators/validations.js";

async function organizationController(fastify, options) {
  // Step 1: Create/Update User Info and Organization Basic Info
  fastify.post(
    "/create",
    {
      preHandler: validate(schemas.organization.createOrganization),
    },
    async (request, reply) => {
      const user_id = request.auth_id;
      const {
        // User fields
        father_name,
        mother_name,
        dob,
        phone_number,
        passport_number,
        nid_number,
        religion,
        blood_group,
        highest_education,
        // Organization fields
        organization_name,
        office_address,
        trade_license_number,
        trade_license_issue_date,
        business_start_date,
        office_size,
        tin_number,
        branch_offices_count,
        organization_mobile,
        website,
        facebook_page,
      } = request.body;

      // Check if organization already exists for this user
      const existingOrg = await prisma.organization.findUnique({
        where: { user_id },
      });

      if (existingOrg) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Organization already exists for this user",
        );
      }

      // Update user info and create organization in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update user info
        const updatedUser = await tx.user.update({
          where: { id: user_id },
          data: {
            father_name,
            mother_name,
            dob: dob ? new Date(dob) : null,
            phone_number,
            passport_number,
            nid_number,
            religion,
            blood_group,
            highest_education,
          },
        });

        // Create organization
        const organization = await tx.organization.create({
          data: {
            user_id,
            organization_name,
            office_address,
            trade_license_number,
            trade_license_issue_date: trade_license_issue_date
              ? new Date(trade_license_issue_date)
              : null,
            business_start_date: business_start_date
              ? new Date(business_start_date)
              : null,
            office_size,
            tin_number,
            branch_offices_count: branch_offices_count
              ? parseInt(branch_offices_count)
              : null,
            organization_mobile,
            website,
            facebook_page,
          },
        });

        return { user: updatedUser, organization };
      });

      return sendResponse(
        reply,
        httpStatus.CREATED,
        "Organization created successfully",
        result,
      );
    },
  );

  // Step 3: Update Represented Institutions and Counselor Ships
  fastify.put(
    "/institutions",
    {
      preHandler: validate(schemas.organization.updateInstitutions),
    },
    async (request, reply) => {
      const user_id = request.auth_id;
      const { represented_institutions, counselor_ships } = request.body;

      // Get organization
      const organization = await prisma.organization.findUnique({
        where: { user_id },
      });

      if (!organization) {
        throw throwError(httpStatus.NOT_FOUND, "Organization not found");
      }

      // Update organization
      const updatedOrg = await prisma.organization.update({
        where: { id: organization.id },
        data: {
          represented_institutions,
          counselor_ships,
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Institutions updated successfully",
        updatedOrg,
      );
    },
  );

  // Step 4: Upload Single Document
  fastify.post(
    "/document",
    {
      preHandler: fileUploadPreHandler({
        folder: "documents",
        allowedTypes: ["docs", "image"],
        fieldLimits: { document: 1 },
        maxFileSizeInMB: 10,
        schema: schemas.organization.uploadDocument,
      }),
    },
    async (request, reply) => {
      const user_id = request.auth_id;
      const { name } = request.upload?.fields || request.body;

      if (!request.upload?.files?.document) {
        throw throwError(httpStatus.BAD_REQUEST, "Document file is required");
      }

      const document = request.upload.files.document;

      // Get organization
      const organization = await prisma.organization.findUnique({
        where: { user_id },
      });

      if (!organization) {
        throw throwError(httpStatus.NOT_FOUND, "Organization not found");
      }

      // Create document record
      const organizationDocument = await prisma.organizationDocument.create({
        data: {
          organization_id: organization.id,
          name,
          file: document,
        },
      });

      return sendResponse(
        reply,
        httpStatus.CREATED,
        "Document uploaded successfully",
        organizationDocument,
      );
    },
  );

  // Get organization details
  fastify.get("/show", async (request, reply) => {
    const user_id = request.auth_id;

    const organization = await prisma.organization.findUnique({
      where: { user_id },
      include: {
        documents: true,
        recommendations: {
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            full_name: true,
            father_name: true,
            mother_name: true,
            email: true,
            avatar: true,
            dob: true,
            phone_number: true,
            passport_number: true,
            nid_number: true,
            religion: true,
            blood_group: true,
            highest_education: true,
          },
        },
      },
    });

    if (!organization) {
      throw throwError(httpStatus.NOT_FOUND, "Organization not found");
    }

    return sendResponse(
      reply,
      httpStatus.OK,
      "Organization details",
      organization,
    );
  });

  // Update organization basic info
  fastify.put(
    "/update",
    {
      preHandler: validate(schemas.organization.updateOrganization),
    },
    async (request, reply) => {
      const user_id = request.auth_id;
      const {
        organization_name,
        office_address,
        trade_license_number,
        trade_license_issue_date,
        business_start_date,
        office_size,
        tin_number,
        branch_offices_count,
        organization_mobile,
        website,
        facebook_page,
      } = request.body;

      const organization = await prisma.organization.findUnique({
        where: { user_id },
      });

      if (!organization) {
        throw throwError(httpStatus.NOT_FOUND, "Organization not found");
      }

      const updatedOrg = await prisma.organization.update({
        where: { id: organization.id },
        data: {
          organization_name,
          office_address,
          trade_license_number,
          trade_license_issue_date: trade_license_issue_date
            ? new Date(trade_license_issue_date)
            : undefined,
          business_start_date: business_start_date
            ? new Date(business_start_date)
            : undefined,
          office_size,
          tin_number,
          branch_offices_count: branch_offices_count
            ? parseInt(branch_offices_count)
            : undefined,
          organization_mobile,
          website,
          facebook_page,
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Organization updated successfully",
        updatedOrg,
      );
    },
  );

  // Delete a document
  fastify.delete("/document/:id", async (request, reply) => {
    const user_id = request.auth_id;
    const document_id = parseInt(request.params.id);

    const organization = await prisma.organization.findUnique({
      where: { user_id },
    });

    if (!organization) {
      throw throwError(httpStatus.NOT_FOUND, "Organization not found");
    }

    const document = await prisma.organizationDocument.findFirst({
      where: {
        id: document_id,
        organization_id: organization.id,
      },
    });

    if (!document) {
      throw throwError(httpStatus.NOT_FOUND, "Document not found");
    }

    // Delete file from storage
    if (document.file?.path) {
      await deleteFiles(document.file.path);
    }

    // Delete document record
    await prisma.organizationDocument.delete({
      where: { id: document_id },
    });

    return sendResponse(reply, httpStatus.OK, "Document deleted successfully");
  });

  // List all documents
  fastify.get("/documents", async (request, reply) => {
    const user_id = request.auth_id;

    const organization = await prisma.organization.findUnique({
      where: { user_id },
      include: {
        documents: true,
      },
    });

    if (!organization) {
      throw throwError(httpStatus.NOT_FOUND, "Organization not found");
    }

    return sendResponse(
      reply,
      httpStatus.OK,
      "Organization documents",
      organization.documents,
    );
  });

  // Add recommendation for an organization (by other users)
  fastify.post(
    "/recommend/:organization_id",
    {
      preHandler: validate(schemas.organization.addRecommendation),
    },
    async (request, reply) => {
      const user_id = request.auth_id;
      const organization_id = parseInt(request.params.organization_id);
      const { comment } = request.body;

      // Check if organization exists
      const organization = await prisma.organization.findUnique({
        where: { id: organization_id },
      });

      if (!organization) {
        throw throwError(httpStatus.NOT_FOUND, "Organization not found");
      }

      // Check if user is trying to recommend their own organization
      if (organization.user_id === user_id) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Cannot recommend your own organization",
        );
      }

      // Check if already recommended
      const existing = await prisma.organizationRecommendation.findUnique({
        where: {
          organization_id_user_id: {
            organization_id,
            user_id,
          },
        },
      });

      if (existing) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "You have already recommended this organization",
        );
      }

      // Create recommendation
      const recommendation = await prisma.organizationRecommendation.create({
        data: {
          organization_id,
          user_id,
          is_approved: true,
          comment,
        },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

      return sendResponse(
        reply,
        httpStatus.CREATED,
        "Recommendation added successfully",
        recommendation,
      );
    },
  );

  // Get recommendations for an organization
  fastify.get("/recommendations/:organization_id", async (request, reply) => {
    const organization_id = parseInt(request.params.organization_id);

    const recommendations = await prisma.organizationRecommendation.findMany({
      where: {
        organization_id,
        is_approved: true,
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return sendResponse(
      reply,
      httpStatus.OK,
      "Organization recommendations",
      recommendations,
    );
  });

  // Remove recommendation
  fastify.delete("/recommend/:organization_id", async (request, reply) => {
    const user_id = request.auth_id;
    const organization_id = parseInt(request.params.organization_id);

    const recommendation = await prisma.organizationRecommendation.findUnique({
      where: {
        organization_id_user_id: {
          organization_id,
          user_id,
        },
      },
    });

    if (!recommendation) {
      throw throwError(httpStatus.NOT_FOUND, "Recommendation not found");
    }

    await prisma.organizationRecommendation.delete({
      where: {
        organization_id_user_id: {
          organization_id,
          user_id,
        },
      },
    });

    return sendResponse(
      reply,
      httpStatus.OK,
      "Recommendation removed successfully",
    );
  });
}

export default organizationController;
