import { prisma } from "../../lib/prisma.js";
import validate from "../../middleware/validate.js";
import httpStatus from "../../utilities/httpStatus.js";
import sendResponse from "../../utilities/sendResponse.js";
import throwError from "../../utilities/throwError.js";
import { adminSchemas } from "../../validators/validations.js";
import { QueueStatus, DeskStatus } from "../../utilities/constant.js";

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

    if (!desk || desk.pin_code !== pin_code) {
      throw throwError(httpStatus.UNAUTHORIZED, "Invalid pin code ");
    }

    if (!desk.is_active) {
      throw throwError(httpStatus.BAD_REQUEST, "Desk is currently inactive");
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
          customer_name: `${
            currentCustomer.application?.user?.first_name || ""
          } ${currentCustomer.application?.user?.last_name || ""}`.trim(),
          phone: currentCustomer.application?.user?.phone_number || null,
          email: currentCustomer.application?.user?.email || null,
          service_type:
            currentCustomer.application?.document_category?.name || null,
          scheduled_time: currentCustomer.application?.time_slot || null,
          status: currentCustomer.status,
          assigned_at: currentCustomer.assigned_at,
        },
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
          customer_name: `${result.application?.user?.first_name || ""} ${
            result.application?.user?.last_name || ""
          }`.trim(),
          phone: result.application?.user?.phone_number || null,
          email: result.application?.user?.email || null,
          service_type: result.application?.document_category?.name || null,
          scheduled_time: result.application?.time_slot || null,
          status: result.status,
          assigned_at: result.assigned_at,
        },
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
        previous: {
          id: result.id,
          serial_number: result.serial_number,
          customer_name: `${result.application?.user?.first_name || ""} ${
            result.application?.user?.last_name || ""
          }`.trim(),
          phone: result.application?.user?.phone_number || null,
          email: result.application?.user?.email || null,
          service_type: result.application?.document_category?.name || null,
          scheduled_time: result.application?.time_slot || null,
          status: result.status,
          assigned_at: result.assigned_at,
        },
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
    }
  );

  fastify.post(
    "/complete/:desk_id",
    {
      preHandler: verifyDeskAndStaff,
    },
    async (request, reply) => {
      const { desk_id } = request.params;

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
    }
  );

  fastify.post(
    "/recall/:desk_id",
    {
      preHandler: verifyDeskAndStaff,
    },
    async (request, reply) => {
    //   const { desk_id } = request.params;
      const { serial_number } = request.body;

      if (!serial_number) {
        throw throwError(httpStatus.BAD_REQUEST, "Serial number is required");
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const missedCustomer = await prisma.queueItem.findFirst({
        where: {
          serial_number,
          status: QueueStatus.MISSED,
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
