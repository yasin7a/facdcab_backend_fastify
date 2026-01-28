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
import { schemas } from "../../../validators/validations.js";

async function userProfileController(fastify, options) {
  fastify.get("/show", async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(request.auth_id) },
      include: {
        organization: {
          select: {
            id: true,
            organization_name: true,
            office_address: true,
            website: true,
            is_setup_complete: true,
          },
        },
      },
    });
    if (!user) {
      throw throwError(httpStatus.NOT_FOUND, "User not found");
    }

    return sendResponse(reply, httpStatus.OK, "User profile", {
      ...user,
      has_password: !!user.password,
      password: undefined,
    });
  });

  fastify.put(
    "/update",
    {
      preHandler: validate(schemas.profile.updateUserProfile),
    },
    async (request, reply) => {
      const userData = request.body;

      userData.dob = userData.dob ? new Date(userData.dob) : null;
      const user_id = request.auth_id;
      if (userData?.email) {
        throw throwError(httpStatus.BAD_REQUEST, "Email cannot be updated");
      }
      // Get current user data
      const currentUser = await prisma.user.findUnique({
        where: { id: user_id },
      });
      // Generate unique slug if first_name changes
      if (
        userData.first_name &&
        userData.first_name !== currentUser.first_name
      ) {
        userData.slug = await generateUniqueSlug(
          userData.first_name,
          currentUser.id,
          prisma.user,
        );
      } else if (!currentUser.first_name) {
        userData.slug = await generateUniqueSlug(
          userData.first_name,
          currentUser.id,
          prisma.user,
        );
      }

      // Update user
      const data = await prisma.user.update({
        omit: {
          password: true,
        },
        where: { id: currentUser.id },
        data: userData,
      });

      return sendResponse(reply, httpStatus.OK, "User Updated", data);
    },
  );

  fastify.post(
    "/avatar",
    {
      preHandler: fileUploadPreHandler({
        folder: "users",
        allowedTypes: ["image"],
        fieldLimits: { avatar: 1 },
        maxFileSizeInMB: 5,
        schema: schemas.profile.avatarUpload,
      }),
    },
    async (request, reply) => {
      const user_id = request.auth_id;
      const userData = request.upload?.fields || request.body;

      // Get current user
      const currentUser = await prisma.user.findUnique({
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
      } else {
        delete userData.avatar;
      }

      // Update user with new avatar
      const updatedUser = await prisma.user.update({
        where: { id: user_id },
        data: userData,
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        userData.avatar === null ? "Avatar removed" : "Avatar uploaded",
        { avatar: updatedUser.avatar },
      );
    },
  );

  // change password
  fastify.post("/change-password", async (request, reply) => {
    const { old_password, new_password } = request.body;
    const userId = parseInt(request.auth_id);

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw throwError(httpStatus.NOT_FOUND, "User not found");
    }
    await validate(
      schemas.profile.changePassword({
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
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return sendResponse(reply, httpStatus.OK, "Password changed");
  });
}

export default userProfileController;
