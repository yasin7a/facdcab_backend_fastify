import { prisma } from "../lib/prisma.js";
import verifyAuth from "../middleware/verifyAuth.js";
import httpStatus from "../utilities/httpStatus.js";
import sendResponse from "../utilities/sendResponse.js";

async function baseRoute(fastify, options) {
  fastify.addHook("preHandler", verifyAuth);
 // example route
  // fastify.get("/documents", async (request, reply) => {
  //   const categories = await prisma.documentCategory.findMany({
  //     where: { is_active: true },
  //     orderBy: { created_at: "desc" },
  //     select: {
  //       id: true,
  //       name: true,
  //       description: true,
  //       document_types: {
  //         select: {
  //           id: true,
  //           name: true,
  //           description: true,
  //           is_required: true,
  //         },
  //       },
  //     },
  //   });
  //   return sendResponse(
  //     reply,
  //     httpStatus.OK,
  //     "Document Categories",
  //     categories
  //   );
  // });
 

}

export default baseRoute;
