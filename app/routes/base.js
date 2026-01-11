import { prisma } from "../lib/prisma.js";
import verifyAuth from "../middleware/verifyAuth.js";
import httpStatus from "../utilities/httpStatus.js";
import sendResponse from "../utilities/sendResponse.js";

async function baseRoute(fastify, options) {
  fastify.addHook("preHandler", verifyAuth);
  fastify.get("/document-categories", async (request, reply) => {
    const categories = await prisma.documentCategory.findMany({
      where: { is_active: true },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        document_types: {
          select: {
            id: true,
            name: true,
            description: true,
            is_required: true,
          },
        },
      },
    });
    return sendResponse(
      reply,
      httpStatus.OK,
      "Document Categories",
      categories
    );
  });
  fastify.get("/document-types", async (request, reply) => {
    const types = await prisma.documentType.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
    return sendResponse(reply, httpStatus.OK, "Document Types", types);
  });

  // add desk
  fastify.get("/desks", async (request, reply) => {
    const desks = await prisma.desk.findMany({
      where: { is_active: true },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
      },
    });
    return sendResponse(reply, httpStatus.OK, "Desks", desks);
  });
}

export default baseRoute;
