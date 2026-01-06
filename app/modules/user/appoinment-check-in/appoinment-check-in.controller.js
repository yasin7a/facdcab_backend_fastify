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
      include: { queue_item: true },
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

    if (appointment.queue_item) {
      const existingQueue = appointment.queue_item;

      if (existingQueue.status === QueueStatus.DONE) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Service already completed. Cannot check in again."
        );
      }

      if (existingQueue.status === QueueStatus.RUNNING) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Already being served at desk"
        );
      }

      if (existingQueue.status === QueueStatus.WAITING) {
        return sendResponse(
          reply,
          httpStatus.OK,
          `Already checked in. Your serial number is ${existingQueue.serial_number}`,
          existingQueue
        );
      }
    }

    const lastQueue = await prisma.queueItem.findFirst({
      orderBy: { serial_number: "desc" },
    });

    const serialNumber = (lastQueue?.serial_number || 0) + 1;

    await prisma.queueItem.create({
      data: {
        application_id: parseInt(application_id),
        serial_number: "S" + serialNumber,
        status: QueueStatus.WAITING,
      },
      include: {
        appointment: true,
      },
    });

    return sendResponse(
      reply,
      httpStatus.CREATED,
      `Checked in successfully. Your serial number is ${serialNumber}`,
      {
        serial_number: "S" + serialNumber,
        status: QueueStatus.WAITING,
      }
    );
  });
}

export default appointmentCheckInController;
