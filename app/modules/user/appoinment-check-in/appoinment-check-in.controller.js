import sendResponse from "../../../utilities/sendResponse.js";
import { prisma } from "../../../lib/prisma.js";
import httpStatus from "../../../utilities/httpStatus.js";
import throwError from "../../../utilities/throwError.js";
import {
  ApplicationStatus,
  BookingStatus,
  QueueStatus,
} from "../../../utilities/constant.js";

async function appointmentCheckInController(fastify) {
  fastify.post("/", async (request, reply) => {
    const { application_id } = request.body;

    if (!application_id) {
      throw throwError(httpStatus.BAD_REQUEST, "application_id is required");
    }

    const appointment = await prisma.application.findUnique({
      where: {
        id: parseInt(application_id),
        status: ApplicationStatus.APPROVED,
      },
    });

    if (!appointment) {
      throw throwError(
        httpStatus.NOT_FOUND,
        "Appointment not found or not approved"
      );
    }

    if (appointment.booking_status === BookingStatus.CANCELLED) {
      throw throwError(httpStatus.BAD_REQUEST, "Appointment is cancelled");
    }

    if (appointment.booking_status !== BookingStatus.BOOKED) {
      throw throwError(httpStatus.BAD_REQUEST, "Appointment is not booked");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingQueueToday = await prisma.queueItem.findFirst({
      where: {
        application_id: parseInt(application_id),
        created_at: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { created_at: "desc" },
    });

    if (existingQueueToday) {
      if (existingQueueToday.status === QueueStatus.DONE) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Service already completed today. Cannot check in again."
        );
      }

      if (existingQueueToday.status === QueueStatus.RUNNING) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Already being served at desk"
        );
      }

      if (
        existingQueueToday.status === QueueStatus.WAITING ||
        existingQueueToday.status === QueueStatus.RECALLED
      ) {
        return sendResponse(
          reply,
          httpStatus.OK,
          `Already checked in. Your serial number is ${existingQueueToday.serial_number}`,
          {
            serial_number: existingQueueToday.serial_number,
            status: existingQueueToday.status,
          }
        );
      }

      if (existingQueueToday.status === QueueStatus.MISSED) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "You missed your turn. Please contact staff for assistance."
        );
      }
    }

    const queueItem = await prisma.$transaction(
      async (tx) => {
        const count = await tx.queueItem.count();
        const newSerialNumber = "S" + (count + 1);

        return await tx.queueItem.create({
          data: {
            application_id: parseInt(application_id),
            serial_number: newSerialNumber,
            status: QueueStatus.WAITING,
          },
          include: {
            application: true,
          },
        });
      },
      {
        isolationLevel: "Serializable",
      }
    );

    return sendResponse(
      reply,
      httpStatus.CREATED,
      `Checked in successfully. Your serial number is ${queueItem.serial_number}`,
      {
        serial_number: queueItem.serial_number,
        status: queueItem.status,
      }
    );
  });
}

export default appointmentCheckInController;
