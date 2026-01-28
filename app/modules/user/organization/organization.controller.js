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
  // Create or Update User Info and Organization - Flexible Save
  fastify.post(
    "/save",
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
        represented_institutions,
        counselor_ships,
      } = request.body;

      // Check if organization already exists for this user
      const existingOrg = await prisma.organization.findUnique({
        where: { user_id },
      });

      // Update user info and create/update organization in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Prepare user data - only include fields that are provided
        const userData = {};
        if (father_name !== undefined) userData.father_name = father_name;
        if (mother_name !== undefined) userData.mother_name = mother_name;
        if (dob !== undefined) userData.dob = dob ? new Date(dob) : null;
        if (phone_number !== undefined) userData.phone_number = phone_number;
        if (passport_number !== undefined)
          userData.passport_number = passport_number;
        if (nid_number !== undefined) userData.nid_number = nid_number;
        if (religion !== undefined) userData.religion = religion;
        if (blood_group !== undefined) userData.blood_group = blood_group;
        if (highest_education !== undefined)
          userData.highest_education = highest_education;

        // Update user info only if there are fields to update
        let updatedUser = null;
        if (Object.keys(userData).length > 0) {
          updatedUser = await tx.user.update({
            where: { id: user_id },
            data: userData,
          });
        }

        // Prepare organization data - only include fields that are provided
        const orgData = {};
        if (organization_name !== undefined)
          orgData.organization_name = organization_name;
        if (office_address !== undefined)
          orgData.office_address = office_address;
        if (trade_license_number !== undefined)
          orgData.trade_license_number = trade_license_number;
        if (trade_license_issue_date !== undefined)
          orgData.trade_license_issue_date = trade_license_issue_date
            ? new Date(trade_license_issue_date)
            : null;
        if (business_start_date !== undefined)
          orgData.business_start_date = business_start_date
            ? new Date(business_start_date)
            : null;
        if (office_size !== undefined) orgData.office_size = office_size;
        if (tin_number !== undefined) orgData.tin_number = tin_number;
        if (branch_offices_count !== undefined)
          orgData.branch_offices_count = branch_offices_count
            ? parseInt(branch_offices_count)
            : null;
        if (organization_mobile !== undefined)
          orgData.organization_mobile = organization_mobile;
        if (website !== undefined) orgData.website = website;
        if (facebook_page !== undefined) orgData.facebook_page = facebook_page;
        if (represented_institutions !== undefined)
          orgData.represented_institutions = represented_institutions;
        if (counselor_ships !== undefined)
          orgData.counselor_ships = counselor_ships;

        let organization;

        if (existingOrg) {
          // Update existing organization only if there are fields to update
          if (Object.keys(orgData).length > 0) {
            organization = await tx.organization.update({
              where: { id: existingOrg.id },
              data: orgData,
            });
          } else {
            organization = existingOrg;
          }
        } else {
          // Create organization - must have at least organization_name
          if (!organization_name) {
            throw throwError(
              httpStatus.BAD_REQUEST,
              "organization_name is required to create organization",
            );
          }
          organization = await tx.organization.create({
            data: {
              user_id,
              ...orgData,
            },
          });
        }

        return { user: updatedUser, organization };
      });

      return sendResponse(
        reply,
        existingOrg ? httpStatus.OK : httpStatus.CREATED,
        existingOrg ? "Organization updated" : "Organization created",
        result,
      );
    },
  );

  // Upload Single Document
  fastify.post(
    "/upload-document",
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

      // Get organization
      const organization = await prisma.organization.findUnique({
        where: { user_id },
      });

      if (!organization) {
        throw throwError(httpStatus.NOT_FOUND, "Organization not found");
      }

      // Check if document with same name already exists
      const existingDocument = await prisma.organizationDocument.findFirst({
        where: {
          organization_id: organization.id,
          name,
        },
      });

      // Check if user wants to remove document
      if (
        request.body?.document === "null" &&
        !request.upload?.files?.document
      ) {
        if (!existingDocument) {
          throw throwError(httpStatus.NOT_FOUND, "Document not found");
        }

        // Delete file from storage
        if (existingDocument.file?.path) {
          await deleteFiles(existingDocument.file.path);
        }

        // Delete document record
        await prisma.organizationDocument.delete({
          where: { id: existingDocument.id },
        });

        return sendResponse(reply, httpStatus.OK, "Document removed");
      }

      // Check if document file is provided
      if (!request.upload?.files?.document) {
        throw throwError(httpStatus.BAD_REQUEST, "Document file is required");
      }

      const document = request.upload.files.document;
      let organizationDocument;

      if (existingDocument) {
        // Delete old file
        if (existingDocument.file?.path) {
          await deleteFiles(existingDocument.file.path);
        }

        // Update existing document
        organizationDocument = await prisma.organizationDocument.update({
          where: { id: existingDocument.id },
          data: {
            file: document,
          },
        });
      } else {
        // Create new document record
        organizationDocument = await prisma.organizationDocument.create({
          data: {
            organization_id: organization.id,
            name,
            file: document,
          },
        });
      }

      return sendResponse(
        reply,
        httpStatus.CREATED,
        existingDocument ? "Document re-uploaded" : "Document uploaded",
        organizationDocument,
      );
    },
  );

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

  // Delete a document
  fastify.delete("/document/:id", async (request, reply) => {
    const user_id = request.auth_id;
    const document_id = parseInt(request.params.id);

    // Validate document_id
    if (isNaN(document_id)) {
      throw throwError(httpStatus.BAD_REQUEST, "Invalid document ID");
    }

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

    return sendResponse(reply, httpStatus.OK, "Document deleted");
  });

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
        "Organization updated",
        updatedOrg,
      );
    },
  );

  // Add recommendation for an organization (by other users)
  fastify.post(
    "/recommend/:organization_id",
    {
      preHandler: validate(schemas.organization.addRecommendation),
    },
    async (request, reply) => {
      const user_id = request.auth_id;
      const organization_id = parseInt(request.params.organization_id);

      // Validate organization_id
      if (isNaN(organization_id)) {
        throw throwError(httpStatus.BAD_REQUEST, "Invalid organization ID");
      }

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
        "Recommendation added",
        recommendation,
      );
    },
  );

  // Get recommendations for an organization
  fastify.get("/recommendations/:organization_id", async (request, reply) => {
    const organization_id = parseInt(request.params.organization_id);

    // Validate organization_id
    if (isNaN(organization_id)) {
      throw throwError(httpStatus.BAD_REQUEST, "Invalid organization ID");
    }

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

    // Validate organization_id
    if (isNaN(organization_id)) {
      throw throwError(httpStatus.BAD_REQUEST, "Invalid organization ID");
    }

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

    return sendResponse(reply, httpStatus.OK, "Recommendation removed");
  });
}

export default organizationController;
