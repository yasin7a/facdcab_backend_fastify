import bcrypt from "bcrypt";
import { prisma } from "../../../lib/prisma.js";
import validate from "../../../middleware/validate.js";
import verifyAuth from "../../../middleware/verifyAuth.js";
import generateToken from "../../../utilities/generateToken.js";
import httpStatus from "../../../utilities/httpStatus.js";
import {
  checkOtp,
  deleteOtp,
  iniOTPForRoute,
  OTP_TYPE,
} from "../../../utilities/otp.js";
import sendResponse from "../../../utilities/sendResponse.js";
import generateUniqueSlug from "../../../utilities/slugify.js";
import throwError from "../../../utilities/throwError.js";
import { schemas } from "../../../validators/validations.js";
import serverConfig from "../../../../config/server.config.js";
import { UserType } from "../../../utilities/constant.js";
import logout from "../../../utilities/logout.js";

async function authUserController(fastify, options) {
  fastify.post(
    "/login",
    {
      preHandler: validate(schemas.auth.userLogin),
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (user && user.id) {
        if (!user.is_active) {
          throw throwError(httpStatus.FORBIDDEN, "User is not active");
        }
        const isValidPassword = await bcrypt
          .compare(password, user.password)
          .catch(() => false);

        if (isValidPassword) {
          if (!user.is_verified) {
            await iniOTPForRoute(
              user.email,
              OTP_TYPE.LOGIN,
              "verification code sent to your email",
              reply,
            );
          }
          if (reply.sent) return;

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

  fastify.post(
    "/register",
    {
      preHandler: validate(schemas.auth.userRegister),
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (user && user.id) {
        throw throwError(httpStatus.BAD_REQUEST, "User already exists");
      }
      const hashedPassword = await bcrypt.hash(password, 5);
      const userData = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          is_active: true,
          user_type: UserType.USER,
        },
      });
      if (userData && userData.id) {
        await iniOTPForRoute(
          userData.email,
          OTP_TYPE.REGISTER,
          "verification code sent to your email",
          reply,
        );
      }
      return sendResponse(reply, httpStatus.OK, "User registered", userData);
    },
  );

  fastify.post(
    "/verify-otp",
    {
      config: {
        rateLimit: {
          max: 4,
          timeWindow: "2 minutes",
        },
      },
      preHandler: validate(schemas.auth.verifyOtp),
    },
    async (request, reply) => {
      const { email, otp, type } = request.body;
      if (!OTP_TYPE[type]) {
        throw throwError(httpStatus.BAD_REQUEST, "Invalid OTP type.");
      }
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw throwError(httpStatus.NOT_FOUND, "User not found");
      }
      if (!user.is_active) {
        throw throwError(httpStatus.FORBIDDEN, "User is not active");
      }

      if (
        user.is_verified &&
        (type === OTP_TYPE.REGISTER || type === OTP_TYPE.LOGIN)
      ) {
        throw throwError(httpStatus.BAD_REQUEST, "User is already verified");
      }

      let token;
      const deleteOtpAfterVerify = await checkOtp(email, otp, type);
      if (type === OTP_TYPE.LOGIN || type === OTP_TYPE.REGISTER) {
        if (deleteOtpAfterVerify) {
          await deleteOtp(email, type);
        }
        const verified_user = await prisma.user.update({
          where: { id: user.id },
          data: { is_verified: true },
        });
        delete verified_user.password;
        token = await generateToken(
          verified_user,
          reply,
          serverConfig.DEVELOPMENT_PRODUCTION_UNSAFE_AUTH,
        );
      }
      return sendResponse(reply, httpStatus.OK, "OTP verified", {
        is_verified: true,
        otp_type: type,
        token,
      });
    },
  );

  fastify.post(
    "/forgot-password",
    {
      preHandler: validate(schemas.auth.forgotPassword),
    },
    async (request, reply) => {
      const { email } = request.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw throwError(httpStatus.NOT_FOUND, "User not found");
      }
      if (!user.is_active) {
        throw throwError(httpStatus.FORBIDDEN, "User is not active");
      }
      if (!user.is_verified) {
        await iniOTPForRoute(
          user.email,
          OTP_TYPE.REGISTER,
          "verification code sent to your email, please verify your email first",
          reply,
        );
      }

      await iniOTPForRoute(
        user.email,
        OTP_TYPE.FORGOT,
        "Forgot password verification code sent to your email",
        reply,
      );
    },
  );

  fastify.post(
    "/reset-password",
    {
      preHandler: validate(schemas.auth.resetPassword),
    },
    async (request, reply) => {
      const { email, otp, password } = request.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw throwError(httpStatus.NOT_FOUND, "User not found");
      }
      if (!user.is_active) {
        throw throwError(httpStatus.FORBIDDEN, "User is not active");
      }
      if (!user.is_verified) {
        throw throwError(httpStatus.FORBIDDEN, "User is not verified");
      }
      const deleteOtpAfterVerify = await checkOtp(email, otp, OTP_TYPE.FORGOT);
      if (deleteOtpAfterVerify) {
        await deleteOtp(email, OTP_TYPE.FORGOT);
      }

      const hashedPassword = await bcrypt.hash(password, 5);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });
      return sendResponse(reply, httpStatus.OK, "Password reset");
    },
  );

  fastify.post(
    "/resend-otp",
    {
      config: {
        rateLimit: {
          max: 4,
          timeWindow: "2 minutes",
        },
      },
      preHandler: validate(schemas.auth.resendOtp),
    },
    async (request, reply) => {
      const { email, type } = request.body;
      if (!OTP_TYPE[type]) {
        throw throwError(httpStatus.BAD_REQUEST, "Invalid OTP type.");
      }
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw throwError(httpStatus.NOT_FOUND, "User not found");
      }
      if (!user.is_active) {
        throw throwError(httpStatus.FORBIDDEN, "User is not active");
      }

      if (
        user.is_verified &&
        (type === OTP_TYPE.LOGIN || type === OTP_TYPE.REGISTER)
      ) {
        throw throwError(httpStatus.BAD_REQUEST, "User is already verified");
      }
      await iniOTPForRoute(user.email, type, "OTP resend", reply);
    },
  );

  fastify.get("/logout", async (request, reply) => {
    logout(reply);
    return sendResponse(reply, httpStatus.OK, "Logged out");
  });

  fastify.get("/test-send-cookie", async (request, reply) => {
    reply.setCookie("test", Math.random().toString(36).substring(2), {
      secure: true,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 86400,
    });
    return sendResponse(reply, httpStatus.OK, "test cookie");
  });
}

export default authUserController;
