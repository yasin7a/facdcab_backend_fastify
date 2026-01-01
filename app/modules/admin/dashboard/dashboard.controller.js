import { prisma } from "../../../lib/prisma.js";
import { UserType } from "../../../utilities/constant.js";
import httpStatus from "../../../utilities/httpStatus.js";
import sendResponse from "../../../utilities/sendResponse.js";
/* ------------------ Helpers ------------------ */

async function getCategoryFilter(request) {
  if (request.user_type !== UserType.STAFF) return {};

  const staff = await prisma.adminUser.findUnique({
    where: { id: request.user_id },
    select: { document_categories: { select: { id: true } } },
  });

  const ids = staff?.document_categories.map((c) => c.id);

  if (!ids?.length) return null;

  return { document_category_id: { in: ids } };
}

function emptyStats() {
  return {
    total_applications: 0,
    total_documents: 0,
    pending_documents: 0,
    approved_documents: 0,
    rejected_documents: 0,
    applications_by_category: [],
  };
}

async function adminDashboardController(fastify) {
  fastify.get("/statistics", async (request, reply) => {
    const categoryFilter = await getCategoryFilter(request);

    // If staff has no assigned categories
    if (categoryFilter === null) {
      return sendResponse(
        reply,
        httpStatus.OK,
        "Application Statistics",
        emptyStats()
      );
    }

    // Build document filter for nested queries
    const documentFilter =
      Object.keys(categoryFilter).length > 0
        ? { application_person: { application: categoryFilter } }
        : {};

    const [
      total_applications,
      total_documents,
      pending_documents,
      approved_documents,
      rejected_documents,
      applications_by_category,
    ] = await Promise.all([
      prisma.application.count({ where: categoryFilter }),

      prisma.document.count({
        where: documentFilter,
      }),

      prisma.document.count({
        where: {
          status: "PENDING",
          ...documentFilter,
        },
      }),

      prisma.document.count({
        where: {
          status: "APPROVED",
          ...documentFilter,
        },
      }),

      prisma.document.count({
        where: {
          status: "REJECTED",
          ...documentFilter,
        },
      }),

      prisma.application.groupBy({
        by: ["document_category_id"],
        where: categoryFilter,
        _count: { id: true },
      }),
    ]);

    const categoryIds = applications_by_category.map(
      (i) => i.document_category_id
    );

    const categories = await prisma.documentCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });

    const categoryMap = Object.fromEntries(
      categories.map((c) => [c.id, c.name])
    );

    return sendResponse(reply, httpStatus.OK, "Application Statistics", {
      total_applications,
      total_documents,
      pending_documents,
      approved_documents,
      rejected_documents,
      applications_by_category: applications_by_category.map((item) => ({
        category_id: item.document_category_id,
        category_name: categoryMap[item.document_category_id],
        application_count: item._count.id,
      })),
    });
  });
}

export default adminDashboardController;
