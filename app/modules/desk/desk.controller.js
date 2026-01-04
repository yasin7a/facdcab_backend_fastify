import { prisma } from "../../lib/prisma.js";
import validate from "../../middleware/validate.js";
import httpStatus from "../../utilities/httpStatus.js";
import offsetPagination from "../../utilities/offsetPagination.js";
import sendResponse from "../../utilities/sendResponse.js";
import throwError from "../../utilities/throwError.js";
import { adminSchemas } from "../../validators/validations.js";

async function adminDeskController(fastify) {
  fastify.get("/list", async (request, reply) => {
    const { page = 1, limit = 10, search } = request.query;

    let where = { is_active: true };

    // Add search functionality
    if (search && search.trim()) {
      where.name = {
        contains: search.trim(),
        mode: "insensitive",
      };
    }

    const data = await offsetPagination({
      model: prisma.desk,
      page,
      limit,
      where,
      orderBy: { created_at: "asc" },
    });

    return sendResponse(reply, httpStatus.OK, "Desks retrieved ", data);
  });

  fastify.post(
    "/create",
    {
      preHandler: validate(adminSchemas.createDesk),
    },
    async (request, reply) => {
      const { name, is_active } = request.body;
      const desk = await prisma.desk.create({ data: { name, is_active } });
      return sendResponse(reply, httpStatus.OK, "Desk created ", desk);
    }
  );

  fastify.put(
    "/status/:id",
    {
      preHandler: validate(adminSchemas.updateDeskStatus),
    },
    async (request, reply) => {
      const { id } = request.params;
      const { status } = request.body;

      const existingDesk = await prisma.desk.findUnique({
        where: { id: parseInt(id) },
      });
      if (!existingDesk) {
        throw throwError(httpStatus.NOT_FOUND, "Desk not found");
      }

      const desk = await prisma.desk.update({
        where: { id: parseInt(id) },
        data: { status },
      });

      return sendResponse(reply, httpStatus.OK, "Desk status updated ", {
        data: desk,
      });
    }
  );

  // 4. Update Desk
  fastify.put(
    "/update/:id",
    {
      preHandler: validate(adminSchemas.updateDesk),
    },
    async (request, reply) => {
      const { id } = request.params;
      const { name, is_active } = request.body;

      const existingDesk = await prisma.desk.findUnique({
        where: { id: parseInt(id) },
      });
      if (!existingDesk) {
        throw throwError(httpStatus.NOT_FOUND, "Desk not found");
      }

      const desk = await prisma.desk.update({
        where: { id: parseInt(id) },
        data: { name, is_active },
      });

      return sendResponse(reply, httpStatus.OK, "Desk updated", desk);
    }
  );

  fastify.get("/show/:id", async (request, reply) => {
    const { id } = request.params;

    const desk = await prisma.desk.findUnique({
      where: { id: parseInt(id) },
    });

    if (!desk) {
      throw throwError(httpStatus.NOT_FOUND, "Desk not found");
    }

    return sendResponse(reply, httpStatus.OK, "Desk details retrieved", desk);
  });

  fastify.delete("/delete/:id", async (request, reply) => {
    const { id } = request.params;
    const desk = await prisma.desk.findUnique({
      where: { id: parseInt(id) },
    });

    if (!desk) {
      throw throwError(httpStatus.NOT_FOUND, "Desk not found");
    }
    await prisma.desk.delete({
      where: { id: parseInt(id) },
    });

    return sendResponse(reply, httpStatus.OK, "Desk deleted");
  });
}

export default adminDeskController;
