import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import { sendApplicationMail } from "../../../services/application-mail.service.js";
import {
  ApplicationStatus,
  DocumentStatus,
  UserType,
} from "../../../utilities/constant.js";
import httpStatus from "../../../utilities/httpStatus.js";
import offsetPagination from "../../../utilities/offsetPagination.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import { adminSchemas } from "../../../validators/validations.js";

/* ------------------ Helpers ------------------ */

const getStaffCategoryFilter = async (request) => {
  if (request.user_type !== UserType.STAFF) return {};

  const staff = await prisma.adminUser.findUnique({
    where: { id: request.auth_id },
    select: { document_categories: { select: { id: true } } },
  });

  const ids = staff?.document_categories.map((c) => c.id);
  if (!ids?.length) return null;

  return { document_category_id: { in: ids } };
};

const addSummary = (app) => {
  const docs = app.application_people.flatMap((p) => p.documents);

  const countByStatus = (s) => docs.filter((d) => d.status === s).length;

  return {
    ...app,
    summary: {
      total_documents: docs.length,
      pending_documents: countByStatus(DocumentStatus.PENDING),
      approved_documents: countByStatus(DocumentStatus.APPROVED),
      rejected_documents: countByStatus(DocumentStatus.REJECTED),
    },
  };
};

const buildTimeline = (app) => {
  const timeline = [];

  // Application created
  timeline.push({
    type: "application_created",
    timestamp: app.created_at,
    description: "Application submitted",
    user: app.user
      ? {
          id: app.user.id,
          name: `${app.user.first_name} ${app.user.last_name}`,
          email: app.user.email,
        }
      : null,
  });

  // Document events
  app.application_people?.forEach((person) => {
    person.documents?.forEach((doc) => {
      // Document uploaded
      timeline.push({
        type: "document_uploaded",
        timestamp: doc.created_at,
        description: `Document uploaded: ${
          doc.document_type?.name || "Unknown"
        }`,
        document_id: doc.id,
        document_type: doc.document_type?.name,
        status: doc.status,
      });

      // Document status changes (if updated_at differs from created_at)
      if (doc.updated_at > doc.created_at) {
        timeline.push({
          type: "document_status_changed",
          timestamp: doc.updated_at,
          description: `Document status changed to ${doc.status}`,
          document_id: doc.id,
          document_type: doc.document_type?.name,
          status: doc.status,
        });
      }

      // Document reviews
      if (doc.review) {
        timeline.push({
          type: "document_reviewed",
          timestamp: doc.review.created_at,
          description: "Document reviewed",
          document_id: doc.id,
          document_type: doc.document_type?.name,
          comment: doc.review.comment,
          reviewed_by: doc.review.review_by
            ? {
                id: doc.review.review_by.id,
                name: `${doc.review.review_by.first_name} ${doc.review.review_by.last_name}`,
                email: doc.review.review_by.email,
              }
            : null,
        });
      }
    });
  });

  // Sort by timestamp descending (most recent first)
  return timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

/* ------------------ Prisma Includes ------------------ */

const listIncludes = {
  user: {
    select: { id: true, first_name: true, last_name: true, email: true },
  },
  document_category: { select: { id: true, name: true } },
  application_people: {
    select: {
      documents: { select: { status: true } },
    },
  },
};

const detailIncludes = {
  user: {
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      avatar: true,
      dob: true,
    },
  },
  document_category: { select: { id: true, name: true, description: true } },
  application_people: {
    include: {
      documents: {
        include: {
          document_type: {
            select: { id: true, name: true, is_required: true },
          },
          review: {
            include: {
              review_by: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  },
};

async function adminApplicationManageController(fastify) {
  fastify.get("/list", async (request, reply) => {
    const { search, page, limit, status, category_id, start_date, end_date } =
      request.query;

    const categoryFilter = await getStaffCategoryFilter(request);
    if (categoryFilter === null) {
      throw throwError(
        httpStatus.FORBIDDEN,
        "Access denied. You don't have permission to view any document categories."
      );
    }

    // Only admin users can filter by category_id independently
    if (category_id && request.user_type === UserType.STAFF) {
      throw throwError(
        httpStatus.FORBIDDEN,
        "Staff users cannot filter by category. You can only view applications from your assigned categories."
      );
    }

    const where = {
      is_submitted: true,
      ...categoryFilter,
      ...(category_id && { document_category_id: Number(category_id) }),
    };

    if (status) {
      const validStatuses = Object.values(ApplicationStatus);
      if (!validStatuses.includes(status.toUpperCase())) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          `Invalid status. Must be one of: ${validStatuses.join(", ")}`
        );
      }
      where.status = status.toUpperCase();
    }

    // Date filtering
    if (start_date || end_date) {
      where.created_at = {};

      if (start_date) {
        // Parse date in UTC to avoid timezone issues
        const dateParts = start_date.split("-");
        let startDateTime;

        if (dateParts.length === 3) {
          const [year, month, day] = dateParts;
          const normalizedDate = `${year}-${month.padStart(
            2,
            "0"
          )}-${day.padStart(2, "0")}`;
          startDateTime = new Date(normalizedDate + "T00:00:00.000Z");
        } else {
          startDateTime = new Date(start_date + "T00:00:00.000Z");
        }

        if (isNaN(startDateTime.getTime())) {
          throw throwError(httpStatus.BAD_REQUEST, "Invalid start_date format");
        }
        where.created_at.gte = startDateTime;
      }

      if (end_date) {
        // Parse date in UTC to avoid timezone issues
        const dateParts = end_date.split("-");
        let endDateTime;

        if (dateParts.length === 3) {
          const [year, month, day] = dateParts;
          const normalizedDate = `${year}-${month.padStart(
            2,
            "0"
          )}-${day.padStart(2, "0")}`;
          endDateTime = new Date(normalizedDate + "T23:59:59.999Z");
        } else {
          endDateTime = new Date(end_date + "T23:59:59.999Z");
        }

        if (isNaN(endDateTime.getTime())) {
          throw throwError(httpStatus.BAD_REQUEST, "Invalid end_date format");
        }
        where.created_at.lte = endDateTime;
      }
    }

    // Search filtering
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        {
          user: {
            first_name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          user: {
            last_name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
        {
          user: {
            email: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const result = await offsetPagination({
      model: prisma.application,
      where,
      page,
      limit,
      include: listIncludes,
      orderBy: { created_at: "desc" },
    });

    return sendResponse(reply, httpStatus.OK, "Applications List", {
      ...result,
      data: result.data.map(addSummary),
    });
  });

  fastify.get("/show/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (!id) throw throwError(httpStatus.BAD_REQUEST, "Invalid application ID");

    const categoryFilter = await getStaffCategoryFilter(request);
    if (categoryFilter === null)
      throw throwError(httpStatus.FORBIDDEN, "Access denied");

    const application = await prisma.application.findFirst({
      where: {
        id,
        ...categoryFilter,
        is_submitted: true,
      },
      include: detailIncludes,
    });

    if (!application)
      throw throwError(httpStatus.NOT_FOUND, "Application not found");

    const response = {
      ...addSummary(application),
      timeline: buildTimeline(application),
    };

    return sendResponse(reply, httpStatus.OK, "Application Details", response);
  });

  fastify.post(
    "/review/:document_id",
    { preHandler: validate(adminSchemas.documentReview) },
    async (request, reply) => {
      const { document_id, application_person_id, application_id } =
        request.body;

      // Check if application exists
      const application = await prisma.application.findUnique({
        where: { id: application_id, is_submitted: true },
      });
      if (!application)
        throw throwError(httpStatus.NOT_FOUND, "Application not found");

      // Check if application person exists and belongs to the application
      const applicationPerson = await prisma.applicationPerson.findFirst({
        where: {
          id: application_person_id,
          application_id: application_id,
        },
      });
      if (!applicationPerson)
        throw throwError(httpStatus.NOT_FOUND, "Application person not found");

      // Check if document exists and belongs to the application person
      const document = await prisma.document.findFirst({
        where: {
          id: document_id,
          application_person_id: application_person_id,
        },
        include: {
          application_person: {
            select: { application: { select: { document_category_id: true } } },
          },
        },
      });

      if (!document)
        throw throwError(httpStatus.NOT_FOUND, "Document not found");

      if (request.user_type === UserType.STAFF) {
        const filter = await getStaffCategoryFilter(request);
        if (
          !filter?.document_category_id?.in?.includes(
            document.application_person.application.document_category_id
          )
        ) {
          throw throwError(httpStatus.FORBIDDEN, "Access denied");
        }
      }

      const result = await prisma.$transaction(async (tx) => ({
        review: await tx.documentReview.upsert({
          where: { document_id },
          update: {
            comment: request.body.comment,
            review_by_id: request.auth_id,
          },
          create: {
            document_id,
            comment: request.body.comment,
            review_by_id: request.auth_id,
          },
        }),
      }));

      return sendResponse(
        reply,
        httpStatus.OK,
        "Document reviewed successfully",
        result
      );
    }
  );

  // CHANGE APPLICATION STATUS
  fastify.post(
    "/application-status-change/:application_id",
    { preHandler: validate(adminSchemas.applicationStatus) },
    async (request, reply) => {
      const application_id = Number(request.params.application_id);
      const { status } = request.body;

      if (!application_id) {
        throw throwError(httpStatus.BAD_REQUEST, "Invalid application ID");
      }

      const categoryFilter = await getStaffCategoryFilter(request);
      if (categoryFilter === null) {
        throw throwError(httpStatus.FORBIDDEN, "Access denied");
      }

      // Check if application exists and user has permission
      const application = await prisma.application.findFirst({
        where: {
          id: application_id,
          ...categoryFilter,
        },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          document_category: {
            select: { id: true, name: true },
          },
        },
      });

      if (!application) {
        throw throwError(httpStatus.NOT_FOUND, "Application not found");
      }

      const updatedApplication = await prisma.application.update({
        where: { id: application_id },
        data: { status },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          document_category: {
            select: { id: true, name: true },
          },
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Application status updated successfully",
        updatedApplication
      );
    }
  );

  // CHANGE DOCUMENT STATUS
  fastify.post(
    "/document-status-change/:document_id",
    { preHandler: validate(adminSchemas.documentStatus) },
    async (request, reply) => {
      const { document_id, application_person_id, application_id } =
        request.body;

      // Check if application exists
      const application = await prisma.application.findUnique({
        where: { id: application_id, is_submitted: true },
      });
      if (!application)
        throw throwError(httpStatus.NOT_FOUND, "Application not found");

      // Check if application person exists and belongs to the application
      const applicationPerson = await prisma.applicationPerson.findFirst({
        where: {
          id: application_person_id,
          application_id: application_id,
        },
      });
      if (!applicationPerson)
        throw throwError(httpStatus.NOT_FOUND, "Application person not found");

      // Check if document exists and belongs to the application person
      const document = await prisma.document.findFirst({
        where: {
          id: document_id,
          application_person_id: application_person_id,
        },
        include: {
          application_person: {
            select: { application: { select: { document_category_id: true } } },
          },
        },
      });

      if (!document)
        throw throwError(httpStatus.NOT_FOUND, "Document not found");

      if (request.user_type === UserType.STAFF) {
        const filter = await getStaffCategoryFilter(request);
        if (
          !filter?.document_category_id?.in?.includes(
            document.application_person.application.document_category_id
          )
        ) {
          throw throwError(httpStatus.FORBIDDEN, "Access denied");
        }
      }

      const updatedDocument = await prisma.document.update({
        where: { id: document_id },
        data: { status: request.body.status },
        include: {
          document_type: {
            select: { id: true, name: true, is_required: true },
          },
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Document status updated successfully",
        updatedDocument
      );
    }
  );

  fastify.post(
    "/send-mail/:application_id",
    {
      config: {
        rateLimit: {
          max: 1,
          timeWindow: "30 seconds",
          errorResponseBuilder: (request, context) => {
            return {
              message:
                "Too many email requests. Please wait 30 seconds before sending another email.",
              statusCode: httpStatus.TOO_MANY_REQUESTS,
            };
          },
        },
      },
    },
    async (request, reply) => {
      const application_id = Number(request.params.application_id);
      if (!application_id)
        throw throwError(httpStatus.BAD_REQUEST, "Invalid application ID");

      const categoryFilter = await getStaffCategoryFilter(request);
      if (categoryFilter === null)
        throw throwError(httpStatus.FORBIDDEN, "Access denied");

      // Check if application exists and get comprehensive data
      const application = await prisma.application.findFirst({
        where: {
          id: application_id,
          is_submitted: true,
          ...categoryFilter,
        },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              avatar: true,
              dob: true,
            },
          },
          document_category: {
            select: { id: true, name: true, description: true },
          },
          application_people: {
            include: {
              documents: {
                select: {
                  id: true,
                  status: true,
                  document_type: {
                    select: { id: true, name: true, is_required: true },
                  },
                  review: {
                    include: {
                      review_by: {
                        select: {
                          id: true,
                          first_name: true,
                          last_name: true,
                          email: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!application) {
        throw throwError(httpStatus.NOT_FOUND, "Application not found");
      }

      // Validate required data before sending email
      if (!application.user?.email) {
        throw throwError(httpStatus.BAD_REQUEST, "User email not found");
      }

      if (!application.user?.first_name || !application.user?.last_name) {
        throw throwError(httpStatus.BAD_REQUEST, "User name not found");
      }
      console.log(
        "Preparing to send email for application ID:",
        application_id
      );

      try {
        // Prepare comprehensive application data for email
        const applicationWithSummary = addSummary(application);

        await sendApplicationMail({
          email: application.user.email,
          name: `${application.user.first_name} ${application.user.last_name}`,
          application_id: application.id,
          user: application.user,
          document_category: application.document_category,
          created_at: application.created_at,
          application: applicationWithSummary,
          updated_at: application.updated_at,
          status: application.status,
          // Add comprehensive data for better email content
          application_people: application.application_people,
          timeline: buildTimeline(application),
          summary: applicationWithSummary.summary,
        });

        return sendResponse(
          reply,
          httpStatus.OK,
          "Email sent successfully to the applicant"
        );
      } catch (emailError) {
        throw throwError(
          httpStatus.INTERNAL_SERVER_ERROR,
          `Failed to send email: ${emailError.message}`
        );
      }
    }
  );

  fastify.get("/category-wise-application-count", async (request, reply) => {
    const categoryFilter = await getStaffCategoryFilter(request);
    if (categoryFilter === null) {
      throw throwError(
        httpStatus.FORBIDDEN,
        "Access denied. You don't have permission to view any document categories."
      );
    }

    // Get all categories with application counts
    const categories = await prisma.documentCategory.findMany({
      where: categoryFilter.document_category_id
        ? { id: { in: categoryFilter.document_category_id.in } }
        : {},
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            applications: {
              where: {
                is_submitted: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Transform the data to a cleaner format
    const categoryCounts = categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      application_count: category._count.applications,
    }));

    return sendResponse(
      reply,
      httpStatus.OK,
      "Category-wise application count",
      categoryCounts
    );
  });
}

export default adminApplicationManageController;
