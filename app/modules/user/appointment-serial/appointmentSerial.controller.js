import sendResponse from "../../../utilities/sendResponse.js";
import { prisma } from "../../../lib/prisma.js";
import httpStatus from "../../../utilities/httpStatus.js";
import throwError from "../../../utilities/throwError.js";
import {
  ApplicationStatus,
  BookingStatus,
  QueueStatus,
} from "../../../utilities/constant.js";

async function appointmentSerialController(fastify) {
  fastify.post("/check-in", async (request, reply) => {
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
        const count = await tx.queueItem.count({
          where: {
            created_at: {
              gte: today,
              lt: tomorrow,
            },
          },
        });
        const newSerialNumber = "S" + (count + 1);

        return await tx.queueItem.create({
          data: {
            application_id: parseInt(application_id),
            serial_number: newSerialNumber,
            status: QueueStatus.WAITING,
          },
          include: {
            application: {
              include: {
                user: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                    phone_number: true,
                  },
                },
                document_category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
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
        application: queueItem?.application,
      }
    );
  });

  fastify.get("/list", async (request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [desks, waitingQueue, missedQueue, recentlyCompleted] =
      await Promise.all([
        prisma.desk.findMany({
          where: { is_active: true },
          select: {
            id: true,
            name: true,
            status: true,
            document_categories: {
              select: {
                id: true,
              },
            },
            queue_items: {
              where: {
                status: QueueStatus.RUNNING,
                created_at: {
                  gte: today,
                  lt: tomorrow,
                },
              },
              select: {
                serial_number: true,
                application: {
                  select: {
                    document_category: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                    user: {
                      select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                      },
                    },
                  },
                },
              },
              take: 1,
            },
          },
        }),

        prisma.queueItem.findMany({
          where: {
            status: { in: [QueueStatus.WAITING, QueueStatus.RECALLED] },
            created_at: {
              gte: today,
              lt: tomorrow,
            },
          },
          select: {
            serial_number: true,
            status: true,
            checked_in_at: true,
            application: {
              select: {
                appointment_date: true,
                time_slot: true,
                document_category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                user: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
          orderBy: [{ status: "desc" }, { checked_in_at: "asc" }],
          take: 10,
        }),

        prisma.queueItem.findMany({
          where: {
            status: QueueStatus.MISSED,
            created_at: {
              gte: today,
              lt: tomorrow,
            },
          },
          select: {
            serial_number: true,
            missed_at: true,
            application: {
              select: {
                appointment_date: true,
                time_slot: true,
                document_category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                user: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
          orderBy: { missed_at: "desc" },
          take: 50,
        }),

        prisma.queueItem.findMany({
          where: {
            status: QueueStatus.DONE,
            created_at: {
              gte: today,
              lt: tomorrow,
            },
          },
          select: {
            serial_number: true,
            completed_at: true,
            assigned_at: true,
            application: {
              select: {
                appointment_date: true,
                time_slot: true,
                document_category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                user: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
            desk: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { completed_at: "desc" },
          take: 5,
        }),
      ]);

    const statusCounts = await prisma.queueItem.groupBy({
      by: ["status"],
      where: {
        created_at: {
          gte: today,
          lt: tomorrow,
        },
      },
      _count: {
        id: true,
      },
    });

    const deskInfo = desks.map((desk) => {
      const currentServing = desk.queue_items[0] || null;

      const deskCategoryIds = desk.document_categories.map((cat) => cat.id);
      const nextInQueue = waitingQueue.find((queueItem) =>
        deskCategoryIds.includes(queueItem.application.document_category.id)
      );

      return {
        desk_id: desk.id,
        desk_name: desk.name,
        status: desk.status,
        current_serial_number: currentServing?.serial_number || null,
        current_user: currentServing
          ? {
              id: currentServing.application.user.id,
              first_name: currentServing.application.user.first_name,
              last_name: currentServing.application.user.last_name,
            }
          : null,
        current_document_category: currentServing
          ? {
              id: currentServing.application.document_category.id,
              name: currentServing.application.document_category.name,
            }
          : null,
        next_serial_number: nextInQueue?.serial_number || null,
      };
    });

    return sendResponse(reply, httpStatus.OK, "Serial list retrieved", {
      desks: deskInfo,
      waiting_queue: waitingQueue.map((q) => ({
        serial_number: q.serial_number,
        user: {
          id: q.application.user.id,
          first_name: q.application.user.first_name,
          last_name: q.application.user.last_name,
        },
        document_category: {
          id: q.application.document_category.id,
          name: q.application.document_category.name,
        },
        appointment_time: q.application.time_slot,
        status: q.status,
        is_recalled: q.status === QueueStatus.RECALLED,
        checked_in_at: q.checked_in_at,
      })),
      missed_queue: missedQueue.map((q) => ({
        serial_number: q.serial_number,
        user: {
          id: q.application.user.id,
          first_name: q.application.user.first_name,
          last_name: q.application.user.last_name,
        },
        document_category: {
          id: q.application.document_category.id,
          name: q.application.document_category.name,
        },
        appointment_time: q.application.time_slot,
        missed_at: q.missed_at,
      })),
      recently_completed: recentlyCompleted.map((q) => ({
        serial_number: q.serial_number,
        user: {
          id: q.application.user.id,
          first_name: q.application.user.first_name,
          last_name: q.application.user.last_name,
        },
        document_category: {
          id: q.application.document_category.id,
          name: q.application.document_category.name,
        },
        desk_name: q.desk?.name,
        service_duration:
          q.assigned_at && q.completed_at
            ? Math.round(
                (new Date(q.completed_at) - new Date(q.assigned_at)) / 60000
              )
            : null,
        completed_at: q.completed_at,
      })),
      statistics: {
        ...statusCounts.reduce(
          (acc, item) => {
            const count = item._count.id;
            acc.total_today += count;
            acc.by_status[item.status.toLowerCase()] = count;

            switch (item.status) {
              case QueueStatus.WAITING:
                acc.total_waiting = count;
                break;
              case QueueStatus.RUNNING:
                acc.total_running = count;
                break;
              case QueueStatus.DONE:
                acc.total_completed = count;
                break;
              case QueueStatus.MISSED:
                acc.total_missed = count;
                break;
              case QueueStatus.RECALLED:
                acc.total_recalled = count;
                break;
            }

            return acc;
          },
          {
            total_today: 0,
            by_status: {},
            total_waiting: 0,
            total_running: 0,
            total_completed: 0,
            total_missed: 0,
            total_recalled: 0,
          }
        ),
      },
    });
  });
}

export default appointmentSerialController;
