import bcrypt from "bcrypt";
import { prisma } from "../../../lib/prisma.js";
import {
  deleteFiles,
  fileUploadPreHandler,
} from "../../../middleware/fileUploader.js";
import validate from "../../../middleware/validate.js";
import httpStatus from "../../../utilities/httpStatus.js";
import sendResponse from "../../../utilities/sendResponse.js";
import generateUniqueSlug from "../../../utilities/slugify.js";
import throwError from "../../../utilities/throwError.js";
import { adminSchemas, schemas } from "../../../validators/validations.js";
import { groupPermissionsByModule } from "../../../utilities/permissionHelper.js";

async function adminUserProfileController(fastify, options) {
  fastify.get("/assigned-role-permission", async (request, reply) => {
    if (!request.role_id) {
      throw throwError(httpStatus.BAD_REQUEST, "Role not assigned");
    }
    const role = await prisma.role.findUnique({
      where: { id: parseInt(request.role_id) },
      include: {
        permissions: true,
      },
    });
    if (!role) {
      throw throwError(httpStatus.NOT_FOUND, "Role not found");
    }
    const data = {
      ...role,
      permissions: groupPermissionsByModule(role.permissions),
    };
    return sendResponse(reply, httpStatus.OK, "Assigned Role Permission", data);
  });

  fastify.get("/show", async (request, reply) => {
    const user = await prisma.adminUser.findUnique({
      where: { id: parseInt(request.auth_id) },
      omit: {
        password: true,
      },
    });
    if (!user) {
      throw throwError(httpStatus.NOT_FOUND, "User not found");
    }
    return sendResponse(reply, httpStatus.OK, "User profile", user);
  });

  fastify.put(
    "/update",
    {
      preHandler: fileUploadPreHandler({
        folder: "admin_users",
        allowedTypes: ["image"],
        fieldLimits: { avatar: 1 },
        maxFileSizeInMB: 5,
        schema: adminSchemas.profile.adminUserUpdateProfile,
      }),
    },
    async (request, reply) => {
      const userData = request.upload?.fields || request.body;

      userData.dob = userData.dob ? new Date(userData.dob) : null;
      const user_id = request.auth_id;
      if (userData?.email) {
        throw throwError(httpStatus.BAD_REQUEST, "Email cannot be updated");
      }
      // Get current user data
      const currentUser = await prisma.adminUser.findUnique({
        where: { id: user_id },
      });

      // Check if user wants to remove avatar
      if (userData.avatar === "null" && !request.upload?.files?.avatar) {
        if (currentUser.avatar?.path) {
          await deleteFiles(currentUser.avatar.path);
        }
        userData.avatar = null;
      }
      // Handle new image upload
      else if (request.upload?.files?.avatar) {
        const avatar = request.upload.files.avatar;

        // Delete old image if exists
        if (currentUser.avatar?.path) {
          await deleteFiles(currentUser.avatar.path);
        }

        userData.avatar = avatar;
      }
      // If avatar not sent, don't update it (keep existing)
      else {
        delete userData.avatar;
      }
      // Hash password if provided
      // if (userData.password) {
      //   userData.password = await bcrypt.hash(userData.password, 5);
      // } else {
      //   delete userData.password;
      // }

      // Generate unique slug if first_name changes
      if (
        userData.first_name &&
        userData.first_name !== currentUser.first_name
      ) {
        userData.slug = await generateUniqueSlug(
          userData.first_name,
          currentUser.id,
          prisma.adminUser,
        );
      } else if (!currentUser.first_name) {
        userData.slug = await generateUniqueSlug(
          userData.first_name,
          currentUser.id,
          prisma.adminUser,
        );
      }

      // Update user
      const data = await prisma.adminUser.update({
        omit: {
          password: true,
        },
        where: { id: currentUser.id },
        data: userData,
      });

      return sendResponse(reply, httpStatus.OK, "User Updated", data);
    },
  );

  // change password
  fastify.post("/change-password", async (request, reply) => {
    const { old_password, new_password } = request.body;
    const userId = parseInt(request.auth_id);

    // Get current user
    const user = await prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw throwError(httpStatus.NOT_FOUND, "User not found");
    }
    await validate(
      schemas.changePassword({
        isOldPasswordRequired: !!user.password,
      }),
    )(request, reply);

    if (user.password) {
      const isValidPassword = await bcrypt
        .compare(old_password, user.password)
        .catch(() => false);

      if (!isValidPassword) {
        throw throwError(httpStatus.FORBIDDEN, "Old password is incorrect");
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 5);

    // Update password
    await prisma.adminUser.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return sendResponse(reply, httpStatus.OK, "Password changed");
  });
}

export default adminUserProfileController;
