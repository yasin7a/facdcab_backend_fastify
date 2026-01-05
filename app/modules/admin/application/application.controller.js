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

const buildSearchFilter = (search) => ({
  OR: ["first_name", "last_name", "email"].map((field) => ({
    user: { [field]: { contains: search, mode: "insensitive" } },
  })),
});

const buildStatusFilter = (status) => ({
  application_people: {
    some: { documents: { some: { status } } },
  },
});

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
    const { search, page, limit, status, category_id } = request.query;

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
      ...(search && buildSearchFilter(search)),
      ...(status && buildStatusFilter(status)),
    };

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
      console.log(application.user);

      try {
        // Prepare comprehensive application data for email
        const applicationWithSummary = addSummary(application);
        
        await sendApplicationMail({
          email: 
          "yasin7arafath@gmail.com"
          //  ||
          //  application.user.email
           ,
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
}

export default adminApplicationManageController;
