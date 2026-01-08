import { prisma } from "../../lib/prisma.js";
import validate from "../../middleware/validate.js";
import httpStatus from "../../utilities/httpStatus.js";
import sendResponse from "../../utilities/sendResponse.js";
import throwError from "../../utilities/throwError.js";
import { adminSchemas } from "../../validators/validations.js";
import { QueueStatus, DeskStatus } from "../../utilities/constant.js";

const QUEUE_ITEM_INCLUDE = {
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
};

const getTodayBoundaries = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today, tomorrow };
};

const formatCustomerResponse = (queueItem) => {
  if (!queueItem) return null;
  return {
    id: queueItem.id,
    serial_number: queueItem.serial_number,
    customer_name: `${queueItem.application?.user?.first_name || ""} ${
      queueItem.application?.user?.last_name || ""
    }`.trim(),
    phone: queueItem.application?.user?.phone_number || null,
    email: queueItem.application?.user?.email || null,
    service_type: queueItem.application?.document_category?.name || null,
    scheduled_time: queueItem.application?.time_slot || null,
    status: queueItem.status,
    assigned_at: queueItem.assigned_at,
  };
};

const verifyDeskAndStaff = async (request, reply) => {
  const { desk_id } = request.params;
  const pin_code = request.body?.pin_code || request.query?.pin_code;

  if (!pin_code) {
    throw throwError(httpStatus.BAD_REQUEST, "Pin code is required");
  }

  const desk = await prisma.desk.findFirst({
    where: {
      id: parseInt(desk_id),
      pin_code,
      is_active: true,
    },
    include: {
      document_categories: {
        where: { is_active: true },
        select: { id: true },
      },
    },
  });

  if (!desk) {
    throw throwError(httpStatus.UNAUTHORIZED, "Invalid desk or pin code");
  }

  const staff = await prisma.adminUser.findUnique({
    where: {
      id: request.auth_id,
      is_active: true,
      desk_permit: true,
      is_verified: true,
    },
    select: { desk_permit: true },
  });

  if (!staff || !staff.desk_permit) {
    throw throwError(
      httpStatus.FORBIDDEN,
      "You do not have desk management permissions"
    );
  }

  request.desk = desk;
  request.staff = staff;
};

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
        where: { id: parseInt(id), is_active: true },
      });
      if (!existingDesk) {
        throw throwError(httpStatus.NOT_FOUND, "Desk not found or not active");
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

  fastify.post("/desk-login", async (request, reply) => {
    const { pin_code, desk_id } = request.body;

    if (!pin_code) {
      throw throwError(httpStatus.BAD_REQUEST, "Pin code is required");
    }

    const desk = await prisma.desk.findFirst({
      where: {
        id: parseInt(desk_id),
        pin_code,
        is_active: true,
      },
    });

    if (!desk) {
      throw throwError(httpStatus.BAD_REQUEST, "Invalid pin code");
    }

    if (desk.status === DeskStatus.BUSY) {
      throw throwError(httpStatus.BAD_REQUEST, "Desk is currently busy");
    }

    const staff = await prisma.adminUser.findUnique({
      where: {
        id: request.auth_id,
        is_active: true,
        desk_permit: true,
        is_verified: true,
      },
      select: { desk_permit: true },
    });

    if (!staff || !staff.desk_permit) {
      throw throwError(
        httpStatus.FORBIDDEN,
        "You do not have desk management permissions"
      );
    }

    return sendResponse(reply, httpStatus.OK, "Desk logged in successfully");
  });

  fastify.get(
    "/current/:desk_id",
    {
      preHandler: verifyDeskAndStaff,
    },
    async (request, reply) => {
      const { desk_id } = request.params;
      const deskId = parseInt(desk_id);
      const { today, tomorrow } = getTodayBoundaries();

      const currentCustomer = await prisma.queueItem.findFirst({
        where: {
          desk_id: deskId,
          status: QueueStatus.RUNNING,
          created_at: {
            gte: today,
            lt: tomorrow,
          },
        },
        include: QUEUE_ITEM_INCLUDE,
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
        current: formatCustomerResponse(currentCustomer),
      });
    }
  );

  fastify.post(
    "/next/:desk_id",
    {
      preHandler: verifyDeskAndStaff,
    },
    async (request, reply) => {
      const { desk_id } = request.params;
      const deskId = parseInt(desk_id);
      const { today, tomorrow } = getTodayBoundaries();

      const result = await prisma.$transaction(async (tx) => {
        const currentCustomer = await tx.queueItem.findFirst({
          where: {
            desk_id: deskId,
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

        const categoryIds = request.desk.document_categories.map((c) => c.id);
        const categoryFilter =
          categoryIds.length > 0
            ? { application: { document_category_id: { in: categoryIds } } }
            : {};

        const nextCustomer = await tx.queueItem.findFirst({
          where: {
            status: { in: [QueueStatus.WAITING, QueueStatus.RECALLED] },
            created_at: {
              gte: today,
              lt: tomorrow,
            },
            ...categoryFilter,
          },
          orderBy: [{ status: "desc" }, { checked_in_at: "asc" }],
          include: QUEUE_ITEM_INCLUDE,
        });

        if (!nextCustomer) {
          return null;
        }

        const updatedCustomer = await tx.queueItem.update({
          where: { id: nextCustomer.id },
          data: {
            status: QueueStatus.RUNNING,
            desk_id: deskId,
            assigned_at: new Date(),
          },
          include: QUEUE_ITEM_INCLUDE,
        });

        await tx.desk.update({
          where: { id: deskId },
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
        next: formatCustomerResponse(result),
      });
    }
  );

  fastify.post(
    "/previous/:desk_id",
    {
      preHandler: verifyDeskAndStaff,
    },
    async (request, reply) => {
      const { desk_id } = request.params;
      const deskId = parseInt(desk_id);
      const { today, tomorrow } = getTodayBoundaries();

      const result = await prisma.$transaction(async (tx) => {
        const currentCustomer = await tx.queueItem.findFirst({
          where: {
            desk_id: deskId,
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

        const categoryIds = request.desk.document_categories.map((c) => c.id);
        const categoryFilter =
          categoryIds.length > 0
            ? { application: { document_category_id: { in: categoryIds } } }
            : {};

        const previousCustomer = await tx.queueItem.findFirst({
          where: {
            desk_id: deskId,
            status: QueueStatus.DONE,
            created_at: {
              gte: today,
              lt: tomorrow,
            },
            ...categoryFilter,
          },
          orderBy: { completed_at: "desc" },
          include: QUEUE_ITEM_INCLUDE,
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
          include: QUEUE_ITEM_INCLUDE,
        });

        await tx.desk.update({
          where: { id: deskId },
          data: { status: DeskStatus.BUSY },
        });

        return updatedCustomer;
      });

      if (!result) {
        return sendResponse(
          reply,
          httpStatus.OK,
          "No previous customer found",
          {
            previous: null,
          }
        );
      }

      return sendResponse(reply, httpStatus.OK, "Previous customer recalled", {
        previous: formatCustomerResponse(result),
      });
    }
  );

  fastify.post(
    "/skip/:desk_id",
    {
      preHandler: verifyDeskAndStaff,
    },
    async (request, reply) => {
      const { desk_id } = request.params;
      const deskId = parseInt(desk_id);
      const { today, tomorrow } = getTodayBoundaries();

      const result = await prisma.$transaction(async (tx) => {
        const currentCustomer = await tx.queueItem.findFirst({
          where: {
            desk_id: deskId,
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
          where: { id: deskId },
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
    }
  );

  fastify.post(
    "/complete/:desk_id",
    {
      preHandler: verifyDeskAndStaff,
    },
    async (request, reply) => {
      const { desk_id } = request.params;
      const deskId = parseInt(desk_id);
      const { today, tomorrow } = getTodayBoundaries();

      const result = await prisma.$transaction(async (tx) => {
        const currentCustomer = await tx.queueItem.findFirst({
          where: {
            desk_id: deskId,
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
          where: { id: deskId },
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
    }
  );

  fastify.post(
    "/recall/:desk_id",
    {
      preHandler: verifyDeskAndStaff,
    },
    async (request, reply) => {
      const { serial_number } = request.body;

      if (!serial_number) {
        throw throwError(httpStatus.BAD_REQUEST, "Serial number is required");
      }

      const { today, tomorrow } = getTodayBoundaries();

      // Get desk categories for filtering
      const categoryIds = request.desk.document_categories.map((c) => c.id);
      const categoryFilter =
        categoryIds.length > 0
          ? { application: { document_category_id: { in: categoryIds } } }
          : {};

      const missedCustomer = await prisma.queueItem.findFirst({
        where: {
          serial_number,
          status: QueueStatus.MISSED,
          created_at: {
            gte: today,
            lt: tomorrow,
          },
          ...categoryFilter,
        },
        include: QUEUE_ITEM_INCLUDE,
      });

      if (!missedCustomer) {
        throw throwError(
          httpStatus.NOT_FOUND,
          "Missed customer with this serial number not found"
        );
      }

      const recalledCustomer = await prisma.queueItem.update({
        where: { id: missedCustomer.id },
        data: {
          status: QueueStatus.RECALLED,
          missed_at: null,
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Customer recalled successfully",
        {
          recalled: {
            serial_number: recalledCustomer.serial_number,
            customer_name: `${
              missedCustomer.application?.user?.first_name || ""
            } ${missedCustomer.application?.user?.last_name || ""}`.trim(),
            service_type:
              missedCustomer.application?.document_category?.name || null,
            status: recalledCustomer.status,
          },
        }
      );
    }
  );
}

export default adminDeskManagerController;
