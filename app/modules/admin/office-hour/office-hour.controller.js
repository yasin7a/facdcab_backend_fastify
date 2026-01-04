import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import httpStatus from "../../../utilities/httpStatus.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import { adminSchemas } from "../../../validators/validations.js";

async function adminManageOfficeHoursController(fastify) {
  fastify.post("/set",{
    preHandler: validate(adminSchemas.officeHours),
  }, async (request, response) => {
    const { start_time, end_time, appointment_duration, weekend_days } =
      request.body;

    if (!start_time || !end_time || !appointment_duration) {
      throwError(httpStatus.BAD_REQUEST, "Missing required fields");
    }

    const existing = await prisma.officeHours.findFirst();

    const officeHours = existing
      ? await prisma.officeHours.update({
          where: { id: existing.id },
          data: {
            start_time,
            end_time,
            appointment_duration,
            weekend_days: weekend_days ?? [0, 6],
          },
        })
      : await prisma.officeHours.create({
          data: {
            start_time,
            end_time,
            appointment_duration,
            weekend_days: weekend_days ?? [0, 6],
          },
        });

    return sendResponse(
      response,
      httpStatus.OK,
      "Office hours updated",
      officeHours
    );
  });

  fastify.get("/get", async (req, res) => {
    const officeHours = await prisma.officeHours.findFirst();
    return sendResponse(res, httpStatus.OK, "Office hours ", officeHours);
  });
}

export default adminManageOfficeHoursController;
