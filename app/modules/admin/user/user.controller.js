import { fi } from "zod/v4/locales";
import { prisma } from "../../../lib/prisma.js";
import httpStatus from "../../../utilities/httpStatus.js";
import offsetPagination from "../../../utilities/offsetPagination.js";
import sendResponse from "../../../utilities/sendResponse.js";

async function adminUserController(fastify) {
  fastify.get("/list", async (request, reply) => {
    const { page, limit, search } = request.query;
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

    const result = await offsetPagination({
      where,
      model: prisma.user,
      page,
      limit,
      omit: {
        password: true,
      },
      include: {
        _count: {
          select: { applications: true },
        },
      },
    });
    const users = result.data.map(({ _count, ...user }) => ({
      ...user,
      application_count: _count.applications,
    }));

    return sendResponse(reply, httpStatus.OK, "User List", {
      data: users,
      pagination: result.pagination,
    });
  });
}
export default adminUserController;
