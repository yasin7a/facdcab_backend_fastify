import { prisma } from "../../../lib/prisma.js";
import { UserType, ApplicationStatus } from "../../../utilities/constant.js";
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

function buildWhereCondition(baseCondition, categoryFilter) {
  if (categoryFilter === null) return null; // Staff has no categories
  return { ...categoryFilter, ...baseCondition };
}

function emptyStats() {
  return {
    total_applications: 0,
    pending_applications: 0,
    approved_applications: 0,
    rejected_applications: 0,
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

    // Build where conditions for different queries
    const pendingWhere = buildWhereCondition(
      { status: ApplicationStatus.PENDING, is_submitted: true },
      categoryFilter
    );
    const rejectedWhere = buildWhereCondition(
      { status: ApplicationStatus.REJECTED, is_submitted: true },
      categoryFilter
    );
    const approvedWhere = buildWhereCondition(
      { status: ApplicationStatus.APPROVED, is_submitted: true },
      categoryFilter
    );

    // Build where condition for applications by category (filtering by valid statuses and is_submitted)
    const categoryStatsWhere = buildWhereCondition(
      {
        status: {
          in: Object.values(ApplicationStatus),
        },
        is_submitted: true,
      },
      categoryFilter
    );

    const [
      total_applications,
      pending_applications,
      approved_applications,
      rejected_applications,
      applications_by_category,
    ] = await Promise.all([
      prisma.application.count({ where: categoryStatsWhere }), // Count all applications with valid statuses
      prisma.application.count({ where: pendingWhere }),
      prisma.application.count({ where: approvedWhere }),
      prisma.application.count({ where: rejectedWhere }),
      prisma.application.groupBy({
        by: ["document_category_id"],
        where: categoryStatsWhere,
        _count: { id: true },
      }),
    ]);

    // Get category names for applications_by_category
    const categoryIds = applications_by_category.map(
      (i) => i.document_category_id
    );
    const categories =
      categoryIds.length > 0
        ? await prisma.documentCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : [];

    const categoryMap = Object.fromEntries(
      categories.map((c) => [c.id, c.name])
    );

    return sendResponse(reply, httpStatus.OK, "Application Statistics", {
      total_applications,
      pending_applications,
      approved_applications,
      rejected_applications,
      applications_by_category: applications_by_category.map((item) => ({
        category_id: item.document_category_id,
        category_name: categoryMap[item.document_category_id],
        application_count: item._count.id,
      })),
    });
  });
}

export default adminDashboardController;
