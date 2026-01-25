import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import httpStatus from "../../../utilities/httpStatus.js";
import offsetPagination from "../../../utilities/offsetPagination.js";
import {
  flattenGroupedPermissions,
  groupPermissionsByModule,
} from "../../../utilities/permissionHelper.js";
import { invalidatePermissionCache } from "../../../utilities/rolePermissionCache.js";
import sendResponse from "../../../utilities/sendResponse.js";
import throwError from "../../../utilities/throwError.js";
import { adminSchemas } from "../../../validators/validations.js";

async function adminRolePermissionController(fastify, options) {
  // Get all permissions grouped by module
  fastify.get("/all-permissions", async (request, reply) => {
    const data = groupPermissionsByModule(fastify.adminRoutesList);
    return sendResponse(reply, httpStatus.OK, "All Permissions", data);
  });

  // Get paginated list of roles
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
      model: prisma.role,
      where,
      page: page,
      limit: limit,
      orderBy: { created_at: "desc" },
    });

    return sendResponse(reply, httpStatus.OK, "Role List", data);
  });

  // Create a new role with permissions
  fastify.post(
    "/create",
    {
      preHandler: validate(adminSchemas.role.createRole),
    },
    async (request, reply) => {
      const { name, permissions, is_admin } = request.body;

      const result = await prisma.$transaction(async (tx) => {
        // Create role
        const role = await tx.role.create({
          data: { name, is_admin },
        });

        // Create permissions if provided
        if (permissions?.length) {
          const flattenedPermissions = flattenGroupedPermissions(
            permissions,
            role.id,
            fastify.adminRoutesList,
          );

          await tx.permission.createMany({
            data: flattenedPermissions,
          });
        }

        return role;
      });

      return sendResponse(reply, httpStatus.OK, "Role Created", result);
    },
  );

  // Update an existing role
  fastify.put(
    "/update/:id",
    {
      preHandler: async (request, reply) => {
        const roleId = parseInt(request.params.id);
        await validate(adminSchemas.role.updateRole({ roleId }))(
          request,
          reply,
        );
      },
    },
    async (request, reply) => {
      const roleId = parseInt(request.params.id);
      const { name, permissions, is_admin } = request.body;

      const updatedRole = await prisma.$transaction(async (tx) => {
        // Update role
        const role = await tx.role.update({
          where: { id: roleId },
          data: { name, is_admin },
        });

        // Handle permissions if provided
        if (permissions?.length) {
          const flattenedPermissions = flattenGroupedPermissions(
            permissions,
            null,
            fastify.adminRoutesList,
          );

          // Upsert each permission
          await Promise.all(
            flattenedPermissions.map((permission) =>
              tx.permission.upsert({
                where: {
                  role_id_module_operation: {
                    role_id: roleId,
                    module: permission.module,
                    operation: permission.operation,
                  },
                },
                update: { is_permit: permission.is_permit },
                create: { ...permission, role_id: roleId },
              }),
            ),
          );
        }

        return role;
      });

      invalidatePermissionCache(roleId);
      return sendResponse(reply, httpStatus.OK, "Role Updated", updatedRole);
    },
  );

  // Get a single role by ID with permissions
  fastify.get("/show/:id", async (request, reply) => {
    const roleId = parseInt(request.params.id);

    // Fetch role with permissions
    const roleData = await prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: true },
    });

    if (!roleData) {
      throw throwError(httpStatus.NOT_FOUND, "Role Not Found");
    }

    const data = {
      ...roleData,
      permissions: groupPermissionsByModule(roleData.permissions),
    };

    return sendResponse(reply, httpStatus.OK, "Role Details", data);
  });

  // Delete a role
  fastify.delete("/delete/:id", async (request, reply) => {
    const roleId = parseInt(request.params.id);

    // Delete role (permissions will be deleted due to cascade)
    const data = await prisma.role.delete({
      where: { id: roleId },
    });

    invalidatePermissionCache(roleId);
    return sendResponse(reply, httpStatus.OK, "Role Deleted", data);
  });
}

export default adminRolePermissionController;
