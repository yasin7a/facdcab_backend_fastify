import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import httpStatus from "../../../utilities/httpStatus.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import { schemas } from "../../../validators/validations.js";

async function recommendationController(fastify, options) {
  // Search organizations to recommend
  fastify.get("/search", async (request, reply) => {
    const { organization_name, office_address, tin_number } = request.query;
    const user_id = request.auth_id;

    // Build where clause dynamically
    const where = {};

    // Don't show user's own organization
    where.user_id = {
      not: user_id,
    };

    if (organization_name) {
      where.organization_name = {
        contains: organization_name,
        mode: "insensitive",
      };
    }

    if (office_address) {
      where.office_address = {
        contains: office_address,
        mode: "insensitive",
      };
    }

    if (tin_number) {
      where.tin_number = {
        contains: tin_number,
        mode: "insensitive",
      };
    }

    const organizations = await prisma.organization.findMany({
      where,
      select: {
        id: true,
        organization_name: true,
        office_address: true,
        tin_number: true,
        organization_mobile: true,
        website: true,
        created_at: true,
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
      "Organizations search results",
      organizations,
    );
  });

  // Send recommendation requests to multiple organizations
  fastify.post(
    "/send-request",
    {
      preHandler: validate(schemas.organization.addRecommendation),
    },
    async (request, reply) => {
      const user_id = request.auth_id;
      const { organization_ids, comment } = request.body;

      // Validate organization_ids is an array
      if (!Array.isArray(organization_ids) || organization_ids.length === 0) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "organization_ids must be a non-empty array",
        );
      }

      // Parse and validate all IDs
      const validIds = [];
      const errors = [];

      for (const org_id of organization_ids) {
        const organization_id = parseInt(org_id);
        if (isNaN(organization_id)) {
          errors.push({
            organization_id: org_id,
            error: "Invalid organization ID",
          });
        } else {
          validIds.push(organization_id);
        }
      }

      if (validIds.length === 0) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "No valid organization IDs provided",
        );
      }

      // Get user's own organization to prevent self-requests
      const userOrganization = await prisma.organization.findUnique({
        where: { user_id },
        select: { id: true },
      });

      // Batch fetch all organizations at once
      const organizations = await prisma.organization.findMany({
        where: {
          id: { in: validIds },
        },
        select: {
          id: true,
          user_id: true,
          organization_name: true,
          office_address: true,
        },
      });

      const organizationMap = new Map(
        organizations.map((org) => [org.id, org]),
      );

      // Check for organizations that don't exist
      for (const id of validIds) {
        if (!organizationMap.has(id)) {
          errors.push({
            organization_id: id,
            error: "Organization not found",
          });
        }
      }

      // Filter out own organization and non-existent ones
      const validOrgIds = validIds.filter((id) => {
        const org = organizationMap.get(id);
        if (!org) return false;

        if (userOrganization && org.user_id === user_id) {
          errors.push({
            organization_id: id,
            error: "Cannot request recommendation for your own organization",
          });
          return false;
        }
        return true;
      });

      if (validOrgIds.length === 0) {
        return sendResponse(
          reply,
          httpStatus.BAD_REQUEST,
          "No valid organizations to send requests to",
          {
            success: [],
            failed: errors,
            total: organization_ids.length,
            successful: 0,
            failed_count: errors.length,
          },
        );
      }

      // Batch check existing recommendations
      const existingRecommendations =
        await prisma.organizationRecommendation.findMany({
          where: {
            organization_id: { in: validOrgIds },
            user_id,
          },
          select: {
            organization_id: true,
            is_approved: true,
          },
        });

      const existingMap = new Map(
        existingRecommendations.map((rec) => [rec.organization_id, rec]),
      );

      // Filter out organizations with existing requests
      const finalOrgIds = validOrgIds.filter((id) => {
        const existing = existingMap.get(id);
        if (existing) {
          errors.push({
            organization_id: id,
            error: existing.is_approved
              ? "You have already recommended this organization"
              : "You have already sent a request to this organization",
          });
          return false;
        }
        return true;
      });

      if (finalOrgIds.length === 0) {
        return sendResponse(
          reply,
          httpStatus.BAD_REQUEST,
          "All requests already exist",
          {
            success: [],
            failed: errors,
            total: organization_ids.length,
            successful: 0,
            failed_count: errors.length,
          },
        );
      }

      // Batch create all recommendations
      await prisma.organizationRecommendation.createMany({
        data: finalOrgIds.map((organization_id) => ({
          organization_id,
          user_id,
          is_approved: false,
          comment,
        })),
      });

      // Fetch created recommendations with full details
      const createdRecommendations =
        await prisma.organizationRecommendation.findMany({
          where: {
            organization_id: { in: finalOrgIds },
            user_id,
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
            organization: {
              select: {
                id: true,
                organization_name: true,
                office_address: true,
              },
            },
          },
        });

      return sendResponse(
        reply,
        httpStatus.CREATED,
        "Recommendation requests processed",
        {
          success: createdRecommendations,
          failed: errors,
          total: organization_ids.length,
          successful: createdRecommendations.length,
          failed_count: errors.length,
        },
      );
    },
  );

  // Get all recommendation requests for my organization (pending + approved)
  fastify.get("/my-requests", async (request, reply) => {
    const user_id = request.auth_id;
    const { status } = request.query; // Optional filter: 'pending', 'approved', or undefined (all)

    // Get user's organization
    const organization = await prisma.organization.findUnique({
      where: { user_id },
    });

    if (!organization) {
      throw throwError(httpStatus.NOT_FOUND, "Organization not found");
    }

    // Build where clause based on status filter
    const where = {
      organization_id: organization.id,
    };

    if (status === "pending") {
      where.is_approved = false;
    } else if (status === "approved") {
      where.is_approved = true;
    }
    // If status is undefined, show all (no filter on is_approved)

    const requests = await prisma.organizationRecommendation.findMany({
      where,
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
      status
        ? `${status.charAt(0).toUpperCase() + status.slice(1)} recommendation requests`
        : "All recommendation requests",
      requests,
    );
  });
  // Remove my recommendation (user can delete their own approved recommendation)
  fastify.delete("/remove/:organization_id", async (request, reply) => {
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

  // Get pending requests for my organization (for approval/rejection)
  fastify.get("/incoming-requests", async (request, reply) => {
    const user_id = request.auth_id;

    // Get user's organization
    const organization = await prisma.organization.findUnique({
      where: { user_id },
    });

    if (!organization) {
      throw throwError(httpStatus.NOT_FOUND, "Organization not found");
    }

    const pendingRequests = await prisma.organizationRecommendation.findMany({
      where: {
        organization_id: organization.id,
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
      "Pending recommendation requests",
      pendingRequests,
    );
  });

  // Approve recommendation request
  fastify.post(
    "/approve",
    {
      preHandler: validate(schemas.organization.approveRecommendation),
    },
    async (request, reply) => {
      const user_id = request.auth_id;
      const { id, response } = request.body;
      const request_id = id || parseInt(request.params.id);

      // Validate request_id
      if (!request_id || isNaN(request_id)) {
        throw throwError(httpStatus.BAD_REQUEST, "Invalid request ID");
      }

      // Get user's organization
      const organization = await prisma.organization.findUnique({
        where: { user_id },
      });

      if (!organization) {
        throw throwError(httpStatus.NOT_FOUND, "Organization not found");
      }

      // Get the recommendation request
      const recommendationRequest =
        await prisma.organizationRecommendation.findUnique({
          where: { id: request_id },
        });

      if (!recommendationRequest) {
        throw throwError(httpStatus.NOT_FOUND, "Request not found");
      }

      // Verify it's for user's organization
      if (recommendationRequest.organization_id !== organization.id) {
        throw throwError(
          httpStatus.FORBIDDEN,
          "You can only approve requests for your organization",
        );
      }

      // Verify it's not already approved
      if (recommendationRequest.is_approved) {
        throw throwError(httpStatus.BAD_REQUEST, "Request already approved");
      }

      // Approve the request
      const approved = await prisma.organizationRecommendation.update({
        where: { id: request_id },
        data: {
          is_approved: true,
          response: response || null,
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

      return sendResponse(reply, httpStatus.OK, "Request approved", approved);
    },
  );

  // Reject recommendation request
  fastify.post(
    "/reject",
    {
      preHandler: validate(schemas.organization.rejectRecommendation),
    },
    async (request, reply) => {
      const user_id = request.auth_id;
      const { id, response } = request.body;
      const request_id = id || parseInt(request.params.id);

      // Validate request_id
      if (!request_id || isNaN(request_id)) {
        throw throwError(httpStatus.BAD_REQUEST, "Invalid request ID");
      }

      // Get user's organization
      const organization = await prisma.organization.findUnique({
        where: { user_id },
      });

      if (!organization) {
        throw throwError(httpStatus.NOT_FOUND, "Organization not found");
      }

      // Get the recommendation request
      const recommendationRequest =
        await prisma.organizationRecommendation.findUnique({
          where: { id: request_id },
        });

      if (!recommendationRequest) {
        throw throwError(httpStatus.NOT_FOUND, "Request not found");
      }

      // Verify it's for user's organization
      if (recommendationRequest.organization_id !== organization.id) {
        throw throwError(
          httpStatus.FORBIDDEN,
          "You can only reject requests for your organization",
        );
      }

      // Verify it's not already approved
      if (recommendationRequest.is_approved) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Cannot reject an approved recommendation",
        );
      }

      // Update the request with response and keep it as rejected (not deleting)
      const rejected = await prisma.organizationRecommendation.update({
        where: { id: request_id },
        data: {
          response: response || null,
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

      return sendResponse(reply, httpStatus.OK, "Request rejected", rejected);
    },
  );
}

export default recommendationController;
