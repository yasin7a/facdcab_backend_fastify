import { prisma } from "../lib/prisma.js";
import { UserType } from "../utilities/constant.js";
import httpStatus from "../utilities/httpStatus.js";
import throwError from "../utilities/throwError.js";

const verifyUserAccount = ({ model, type }) => {
  // Normalize type to array once
  const allowedTypes = Array.isArray(type) ? type : [type];

  return async (request, reply) => {
    const { auth_id } = request;
    if (!auth_id) {
      throw throwError(httpStatus.UNAUTHORIZED, "Unauthorized access!");
    }
    const user = await prisma[model].findUnique({
      where: { id: auth_id },
      select: {
        is_active: true,
        is_verified: true,
        user_type: true,
        ...(model !== UserType?.USER?.toLowerCase?.() && {
          role_id: true,
        }),
      },
    });

    // Check if user exists first
    if (!user) {
      throw throwError(httpStatus.UNAUTHORIZED, "Unauthorized access!");
    }

    // Check user type
    if (!allowedTypes.includes(user.user_type)) {
      throw throwError(httpStatus.UNAUTHORIZED, "Invalid user type!");
    }

    // Check verification status
    if (!user.is_verified) {
      throw throwError(
        httpStatus.UNAUTHORIZED,
        "This account is not verified!"
      );
    }

    // Check active status
    if (!user.is_active) {
      throw throwError(httpStatus.UNAUTHORIZED, "This account is not active!");
    }
    request.role_id = user.role_id;
    request.user_type = user.user_type;
  };
};

export default verifyUserAccount;
