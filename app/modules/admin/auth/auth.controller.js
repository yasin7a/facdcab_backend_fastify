import bcrypt from "bcrypt";
import serverConfig from "../../../../config/server.config.js";
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import { UserType } from "../../../utilities/constant.js";
import generateToken from "../../../utilities/generateToken.js";
import httpStatus from "../../../utilities/httpStatus.js";
import logout from "../../../utilities/logout.js";
import sendResponse from "../../../utilities/sendResponse.js";
import generateUniqueSlug from "../../../utilities/slugify.js";
import throwError from "../../../utilities/throwError.js";
import { adminSchemas } from "../../../validators/validations.js";

export async function alphaAdminController(fastify, options) {
  fastify.post("/add-alpha-admin", async (request, reply) => {
    const { email, password, code } = request.body || {};
    if (code !== "00000101") {
      throw throwError(httpStatus.FORBIDDEN, "Invalid Request");
    }

    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (user) {
      throw throwError(httpStatus.FORBIDDEN, "User is already exists");
    }
    const first_name = "Alpha";
    const last_name = "Admin";
    // create admin
    const hashedPassword = await bcrypt.hash(password, 5);
    const slug = await generateUniqueSlug(first_name, null, prisma.adminUser);
    await prisma.adminUser.create({
      data: {
        first_name,
        last_name,
        email,
        password: hashedPassword,
        user_type: UserType.ADMIN,
        slug,
      },
    });
    return sendResponse(reply, httpStatus.OK, "Alpha admin created");
  });
}

async function authAdminUserController(fastify, options) {
  fastify.post(
    "/login",
    {
      preHandler: validate(adminSchemas.auth.adminUserLogin),
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await prisma.adminUser.findUnique({ where: { email } });
      if (user && user.id) {
        if (!user.is_active) {
          throw throwError(httpStatus.FORBIDDEN, "User is not active");
        }
        const isValidPassword = await bcrypt
          .compare(password, user.password)
          .catch(() => false);

        if (isValidPassword) {
          delete user.password;
          const token = await generateToken(
            user,
            reply,
            serverConfig.DEVELOPMENT_PRODUCTION_UNSAFE_AUTH,
          );

          return sendResponse(reply, httpStatus.OK, "User logged in", {
            data: user,
            token,
          });
        } else {
          throw throwError(
            httpStatus.FORBIDDEN,
            "Invalid credentials! Please try again.",
          );
        }
      } else {
        throw throwError(
          httpStatus.FORBIDDEN,
          "Invalid credentials! Please try again.",
        );
      }
    },
  );

  fastify.get("/logout", async (request, reply) => {
    logout(reply);
    return sendResponse(reply, httpStatus.OK, "Logged out");
  });
}

export default authAdminUserController;
