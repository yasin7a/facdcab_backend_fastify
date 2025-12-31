import { prisma } from "../../../lib/prisma.js";
import offsetPagination from "../../../utilities/offsetPagination.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import validate from "../../../middleware/validate.js";
import { adminSchemas } from "../../../validators/validations.js";

async function adminDocumentCategoryController(fastify, options) {
  fastify.get("/list", async (request, reply) => {
    const { search, page, limit } = request.query;
    const where = {};

    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    const data = await offsetPagination({
      model: prisma.documentCategory,
      where,
      page: page,
      limit: limit,
      orderBy: { created_at: "desc" },
      include: {
        document_types: true,
      },
    });

    return sendResponse(reply, httpStatus.OK, "Document Category List", data);
  });

  fastify.get("/show/:id", async (request, reply) => {
    const categoryId = parseInt(request.params.id);

    const category = await prisma.documentCategory.findUnique({
      where: { id: categoryId },
      include: {
        document_types: true,
      },
    });

    if (!category) {
      throw throwError(httpStatus.NOT_FOUND, "Document Category Not Found");
    }

    return sendResponse(
      reply,
      httpStatus.OK,
      "Document Category Details",
      category
    );
  });

  fastify.post(
    "/create",
    {
      preHandler: validate(adminSchemas.createDocumentCategory),
    },
    async (request, reply) => {
      const { name, description, document_type_ids, is_active } = request.body;
      const count = await prisma.documentType.count({
        where: { id: { in: document_type_ids } },
      });

      if (count !== document_type_ids.length) {
        throw new Error("Invalid document_type_ids");
      }
      const category = await prisma.documentCategory.create({
        data: {
          created_by_id: request.auth_id,
          name,
          description,
          is_active,
          document_types: {
            connect: document_type_ids?.map((id) => ({ id })) || [],
          },
        },
        include: {
          document_types: true,
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Document Category Created",
        category
      );
    }
  );

  fastify.put(
    "/update/:id",
    {
      preHandler: async (request, reply) => {
        const categoryId = parseInt(request.params.id);
        await validate(adminSchemas.updateDocumentCategory({ categoryId }))(
          request,
          reply
        );
      },
    },
    async (request, reply) => {
      const categoryId = parseInt(request.params.id);
      const { name, description, document_type_ids, is_active } = request.body;
      const count = await prisma.documentType.count({
        where: { id: { in: document_type_ids } },
      });
      if (count !== document_type_ids.length) {
        throw new Error("Invalid document_type_ids");
      }
      const category = await prisma.documentCategory.update({
        where: { id: categoryId },
        data: {
          updated_by_id: request.auth_id,
          name,
          description,
          is_active,
          document_types: {
            set: document_type_ids?.map((id) => ({ id })) || [],
          },
        },
        include: {
          document_types: true,
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Document Category Updated",
        category
      );
    }
  );

  fastify.delete("/delete/:id", async (request, reply) => {
    const categoryId = parseInt(request.params.id);

    const category = await prisma.documentCategory.delete({
      where: { id: categoryId },
    });

    return sendResponse(reply, httpStatus.OK, "Document Category Deleted");
  });
}

export default adminDocumentCategoryController;
