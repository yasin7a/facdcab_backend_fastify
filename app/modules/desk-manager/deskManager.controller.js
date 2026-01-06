import { prisma } from "../../lib/prisma.js";
import validate from "../../middleware/validate.js";
import httpStatus from "../../utilities/httpStatus.js";
import sendResponse from "../../utilities/sendResponse.js";
import throwError from "../../utilities/throwError.js";
import { adminSchemas } from "../../validators/validations.js";
import { QueueStatus, DeskStatus } from "../../utilities/constant.js";

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

  fastify.post("/auth/verify-pincode", async (request, reply) => {
    const { pin_code } = request.body;

    if (!pin_code) {
      throw throwError(httpStatus.BAD_REQUEST, "Pin code is required");
    }

    const desk = await prisma.desk.findFirst({
      where: {
        pin_code,
        is_active: true,
      },
      include: {
        document_categories: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!desk) {
      throw throwError(httpStatus.UNAUTHORIZED, "Invalid pin code");
    }

    return sendResponse(reply, httpStatus.OK, "Authentication successful", {
      desk: {
        id: desk.id,
        name: desk.name,
        status: desk.status,
        categories: desk.document_categories,
      },
    });
  });

  fastify.get("/queue/current/:desk_id", async (request, reply) => {
    const { desk_id } = request.params;
    const { pin_code } = request.query;

    const staff = await prisma.adminUser.findUnique({
      where: { id: request.auth_id },
      select: { desk_permit: true },
    });

    if (!staff || !staff.desk_permit) {
      throw throwError(
        httpStatus.FORBIDDEN,
        "You do not have desk management permissions"
      );
    }

    const desk = await prisma.desk.findFirst({
      where: {
        id: parseInt(desk_id),
        pin_code,
        is_active: true,
      },
    });

    if (!desk) {
      throw throwError(httpStatus.UNAUTHORIZED, "Invalid desk or pin code");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentCustomer = await prisma.queueItem.findFirst({
      where: {
        desk_id: parseInt(desk_id),
        status: QueueStatus.RUNNING,
        created_at: {
          gte: today,
          lt: tomorrow,
        },
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

    if (!currentCustomer) {
      return sendResponse(
        reply,
        httpStatus.OK,
        "No customer currently being served",
        {
          current: null,
        }
      );
    }

    return sendResponse(reply, httpStatus.OK, "Current customer retrieved", {
      current: {
        id: currentCustomer.id,
        serial_number: currentCustomer.serial_number,
        customer_name: `${currentCustomer.application.user.first_name} ${
          currentCustomer.application.user.last_name || ""
        }`.trim(),
        phone: currentCustomer.application.user.phone_number,
        email: currentCustomer.application.user.email,
        service_type: currentCustomer.application.document_category.name,
        scheduled_time: currentCustomer.application.time_slot,
        status: currentCustomer.status,
        assigned_at: currentCustomer.assigned_at,
      },
    });
  });

  fastify.post("/queue/next/:desk_id", async (request, reply) => {
    const { desk_id } = request.params;
    const { pin_code } = request.body;

    const desk = await prisma.desk.findFirst({
      where: {
        id: parseInt(desk_id),
        pin_code,
        is_active: true,
      },
    });

    if (!desk) {
      throw throwError(httpStatus.UNAUTHORIZED, "Invalid desk or pin code");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await prisma.$transaction(async (tx) => {
      const currentCustomer = await tx.queueItem.findFirst({
        where: {
          desk_id: parseInt(desk_id),
          status: QueueStatus.RUNNING,
          created_at: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (currentCustomer) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Please complete or skip current customer first"
        );
      }

      const nextCustomer = await tx.queueItem.findFirst({
        where: {
          status: { in: [QueueStatus.WAITING, QueueStatus.RECALLED] },
          created_at: {
            gte: today,
            lt: tomorrow,
          },
        },
        orderBy: [{ status: "desc" }, { checked_in_at: "asc" }],
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

      if (!nextCustomer) {
        return null;
      }

      const updatedCustomer = await tx.queueItem.update({
        where: { id: nextCustomer.id },
        data: {
          status: QueueStatus.RUNNING,
          desk_id: parseInt(desk_id),
          assigned_at: new Date(),
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

      await tx.desk.update({
        where: { id: parseInt(desk_id) },
        data: { status: DeskStatus.BUSY },
      });

      return updatedCustomer;
    });

    if (!result) {
      return sendResponse(reply, httpStatus.OK, "Queue is empty", {
        next: null,
      });
    }

    return sendResponse(reply, httpStatus.OK, "Next customer assigned", {
      next: {
        id: result.id,
        serial_number: result.serial_number,
        customer_name: `${result.application.user.first_name} ${
          result.application.user.last_name || ""
        }`.trim(),
        phone: result.application.user.phone_number,
        email: result.application.user.email,
        service_type: result.application.document_category.name,
        scheduled_time: result.application.time_slot,
        status: result.status,
        assigned_at: result.assigned_at,
      },
    });
  });

  fastify.post("/queue/previous/:desk_id", async (request, reply) => {
    const { desk_id } = request.params;
    const { pin_code } = request.body;

    const desk = await prisma.desk.findFirst({
      where: {
        id: parseInt(desk_id),
        pin_code,
        is_active: true,
      },
    });

    if (!desk) {
      throw throwError(httpStatus.UNAUTHORIZED, "Invalid desk or pin code");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await prisma.$transaction(async (tx) => {
      const currentCustomer = await tx.queueItem.findFirst({
        where: {
          desk_id: parseInt(desk_id),
          status: QueueStatus.RUNNING,
          created_at: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (currentCustomer) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Please complete or skip current customer first"
        );
      }

      const previousCustomer = await tx.queueItem.findFirst({
        where: {
          desk_id: parseInt(desk_id),
          status: QueueStatus.DONE,
          created_at: {
            gte: today,
            lt: tomorrow,
          },
        },
        orderBy: { completed_at: "desc" },
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

      if (!previousCustomer) {
        return null;
      }

      const updatedCustomer = await tx.queueItem.update({
        where: { id: previousCustomer.id },
        data: {
          status: QueueStatus.RUNNING,
          assigned_at: new Date(),
          completed_at: null,
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

      await tx.desk.update({
        where: { id: parseInt(desk_id) },
        data: { status: DeskStatus.BUSY },
      });

      return updatedCustomer;
    });

    if (!result) {
      return sendResponse(reply, httpStatus.OK, "No previous customer found", {
        previous: null,
      });
    }

    return sendResponse(reply, httpStatus.OK, "Previous customer recalled", {
      previous: {
        id: result.id,
        serial_number: result.serial_number,
        customer_name: `${result.application.user.first_name} ${
          result.application.user.last_name || ""
        }`.trim(),
        phone: result.application.user.phone_number,
        email: result.application.user.email,
        service_type: result.application.document_category.name,
        scheduled_time: result.application.time_slot,
        status: result.status,
        assigned_at: result.assigned_at,
      },
    });
  });

  fastify.post("/queue/skip/:desk_id", async (request, reply) => {
    const { desk_id } = request.params;
    const { pin_code } = request.body;

    const desk = await prisma.desk.findFirst({
      where: {
        id: parseInt(desk_id),
        pin_code,
        is_active: true,
      },
    });

    if (!desk) {
      throw throwError(httpStatus.UNAUTHORIZED, "Invalid desk or pin code");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await prisma.$transaction(async (tx) => {
      const currentCustomer = await tx.queueItem.findFirst({
        where: {
          desk_id: parseInt(desk_id),
          status: QueueStatus.RUNNING,
          created_at: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (!currentCustomer) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "No customer currently being served"
        );
      }

      const skippedCustomer = await tx.queueItem.update({
        where: { id: currentCustomer.id },
        data: {
          status: QueueStatus.MISSED,
          desk_id: null,
          missed_at: new Date(),
        },
      });

      await tx.desk.update({
        where: { id: parseInt(desk_id) },
        data: { status: DeskStatus.AVAILABLE },
      });

      return skippedCustomer;
    });

    return sendResponse(
      reply,
      httpStatus.OK,
      "Customer marked as absent/skipped",
      {
        skipped: {
          serial_number: result.serial_number,
          status: result.status,
        },
      }
    );
  });

  fastify.post("/queue/complete/:desk_id", async (request, reply) => {
    const { desk_id } = request.params;
    const { pin_code } = request.body;

    const desk = await prisma.desk.findFirst({
      where: {
        id: parseInt(desk_id),
        pin_code,
        is_active: true,
      },
    });

    if (!desk) {
      throw throwError(httpStatus.UNAUTHORIZED, "Invalid desk or pin code");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await prisma.$transaction(async (tx) => {
      const currentCustomer = await tx.queueItem.findFirst({
        where: {
          desk_id: parseInt(desk_id),
          status: QueueStatus.RUNNING,
          created_at: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (!currentCustomer) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "No customer currently being served"
        );
      }

      const completedCustomer = await tx.queueItem.update({
        where: { id: currentCustomer.id },
        data: {
          status: QueueStatus.DONE,
          completed_at: new Date(),
        },
      });

      await tx.desk.update({
        where: { id: parseInt(desk_id) },
        data: { status: DeskStatus.AVAILABLE },
      });

      return completedCustomer;
    });

    return sendResponse(
      reply,
      httpStatus.OK,
      "Service completed successfully",
      {
        completed: {
          serial_number: result.serial_number,
          status: result.status,
          completed_at: result.completed_at,
        },
      }
    );
  });

  fastify.get("/queue/list/:desk_id", async (request, reply) => {
    const { desk_id } = request.params;
    const { pin_code } = request.query;

    const desk = await prisma.desk.findFirst({
      where: {
        id: parseInt(desk_id),
        pin_code,
        is_active: true,
      },
      include: {
        document_categories: true,
      },
    });

    if (!desk) {
      throw throwError(httpStatus.UNAUTHORIZED, "Invalid desk or pin code");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const categoryIds = desk.document_categories.map((cat) => cat.id);

    const [currentCustomer, waitingQueue, completedCount, missedCount] =
      await Promise.all([
        prisma.queueItem.findFirst({
          where: {
            desk_id: parseInt(desk_id),
            status: QueueStatus.RUNNING,
            created_at: {
              gte: today,
              lt: tomorrow,
            },
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
        }),

        prisma.queueItem.findMany({
          where: {
            status: { in: [QueueStatus.WAITING, QueueStatus.RECALLED] },
            created_at: {
              gte: today,
              lt: tomorrow,
            },
            application: {
              document_category_id: { in: categoryIds },
            },
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
          orderBy: [{ status: "desc" }, { checked_in_at: "asc" }],
        }),

        prisma.queueItem.count({
          where: {
            desk_id: parseInt(desk_id),
            status: QueueStatus.DONE,
            created_at: {
              gte: today,
              lt: tomorrow,
            },
          },
        }),

        prisma.queueItem.count({
          where: {
            desk_id: parseInt(desk_id),
            status: QueueStatus.MISSED,
            created_at: {
              gte: today,
              lt: tomorrow,
            },
          },
        }),
      ]);

    return sendResponse(reply, httpStatus.OK, "Queue list retrieved", {
      desk: {
        id: desk.id,
        name: desk.name,
        status: desk.status,
        categories: desk.document_categories,
      },
      current: currentCustomer
        ? {
            id: currentCustomer.id,
            serial_number: currentCustomer.serial_number,
            customer_name: `${currentCustomer.application.user.first_name} ${
              currentCustomer.application.user.last_name || ""
            }`.trim(),
            phone: currentCustomer.application.user.phone_number,
            email: currentCustomer.application.user.email,
            service_type: currentCustomer.application.document_category.name,
            scheduled_time: currentCustomer.application.time_slot,
            status: currentCustomer.status,
            assigned_at: currentCustomer.assigned_at,
          }
        : null,
      waiting_queue: waitingQueue.map((item) => ({
        id: item.id,
        serial_number: item.serial_number,
        customer_name: `${item.application.user.first_name} ${
          item.application.user.last_name || ""
        }`.trim(),
        phone: item.application.user.phone_number,
        email: item.application.user.email,
        service_type: item.application.document_category.name,
        scheduled_time: item.application.time_slot,
        status: item.status,
        checked_in_at: item.checked_in_at,
      })),
      statistics: {
        waiting: waitingQueue.length,
        completed_today: completedCount,
        missed_today: missedCount,
      },
    });
  });

  fastify.get("/desks", async (request, reply) => {
    const desks = await prisma.desk.findMany({
      where: { is_active: true },
      include: {
        document_categories: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return sendResponse(reply, httpStatus.OK, "Desks retrieved", {
      desks: desks.map((desk) => ({
        id: desk.id,
        name: desk.name,
        status: desk.status,
        categories: desk.document_categories,
      })),
    });
  });

  fastify.get("/categories", async (request, reply) => {
    const categories = await prisma.documentCategory.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: "asc" },
    });

    return sendResponse(reply, httpStatus.OK, "Categories retrieved", {
      categories,
    });
  });
}

export default adminDeskManagerController;
