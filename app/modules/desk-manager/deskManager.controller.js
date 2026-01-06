import { prisma } from "../../lib/prisma";
import validate from "../../middleware/validate";
import httpStatus from "../../utilities/httpStatus";
import sendResponse from "../../utilities/sendResponse";
import { adminSchemas } from "../../validators/validations";

async function adminDeskManagerController(fastify) {
  fastify.post(
    "/availability-check/:id",
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
}

export default adminDeskManagerController;
