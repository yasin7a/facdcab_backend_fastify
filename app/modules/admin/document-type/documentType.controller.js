import { prisma } from "../../../lib/prisma.js";
import offsetPagination from "../../../utilities/offsetPagination.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import httpStatus from "../../../utilities/httpStatus.js";
import validate from "../../../middleware/validate.js";
import { adminSchemas } from "../../../validators/validations.js";

async function adminDocumentTypeController(fastify, options) {
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
      model: prisma.documentType,
      where,
      page: page,
      limit: limit,
      orderBy: { created_at: "desc" },
      include: {
        created_by: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
        updated_by: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    return sendResponse(reply, httpStatus.OK, "Document Type List", data);
  });

  fastify.get("/show/:id", async (request, reply) => {
    const documentTypeId = parseInt(request.params.id);

    const documentType = await prisma.documentType.findUnique({
      where: { id: documentTypeId },
      include: {
        created_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        updated_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!documentType) {
      throw throwError(httpStatus.NOT_FOUND, "Document Type Not Found");
    }

    return sendResponse(
      reply,
      httpStatus.OK,
      "Document Type Details",
      documentType
    );
  });

  fastify.post(
    "/create",
    {
      preHandler: validate(adminSchemas.createDocumentType),
    },
    async (request, reply) => {
      const { name, description, is_required } = request.body;

      const documentType = await prisma.documentType.create({
        data: {
          created_by_id: request.auth_id,
          name,
          description,
          is_required,
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Document Type Created",
        documentType
      );
    }
  );

  fastify.put(
    "/update/:id",
    {
      preHandler: async (request, reply) => {
        const documentTypeId = parseInt(request.params.id);
        await validate(adminSchemas.updateDocumentType({ documentTypeId }))(
          request,
          reply
        );
      },
    },
    async (request, reply) => {
      const documentTypeId = parseInt(request.params.id);
      const { name, description, is_required } = request.body;

      const documentType = await prisma.documentType.update({
        where: { id: documentTypeId },
        data: {
          updated_by_id: request.auth_id,
          name,
          description,
          is_required,
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Document Type Updated",
        documentType
      );
    }
  );

  fastify.delete("/delete/:id", async (request, reply) => {
    const documentTypeId = parseInt(request.params.id);

    const documentsCount = await prisma.document.count({
      where: { document_type_id: documentTypeId },
    });

    if (documentsCount > 0) {
      throw throwError(
        httpStatus.BAD_REQUEST,
        `Cannot delete this document type. It is being used by ${documentsCount} document(s).`
      );
    }

    const categoriesCount = await prisma.documentCategory.count({
      where: {
        document_types: {
          some: { id: documentTypeId },
        },
      },
    });

    if (categoriesCount > 0) {
      throw throwError(
        httpStatus.BAD_REQUEST,
        `Cannot delete this document type. It is linked to ${categoriesCount} document category(ies).`
      );
    }

    const documentType = await prisma.documentType.delete({
      where: { id: documentTypeId },
    });

    return sendResponse(reply, httpStatus.OK, "Document Type Deleted");
  });
}

export default adminDocumentTypeController;
