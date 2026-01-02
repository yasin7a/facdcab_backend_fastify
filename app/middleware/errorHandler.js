import serverConfig from "../../config/server.config.js";
import httpStatus from "../utilities/httpStatus.js";
import logout from "../utilities/logout.js";
import throwError from "../utilities/throwError.js";
import logger from "./logging.js";

function parseError(err) {
  try {
    const parsed = JSON.parse(err.message);
    const check = typeof parsed === "object" && parsed !== null;

    return check
      ? {
          message: parsed?.message,
          error: parsed?.error,
        }
      : null;
  } catch (error) {
    return null;
  }
}

// 404 not found handler
function notFoundHandler(request, reply) {
  const error = throwError(httpStatus.NOT_FOUND, "Route not found");
  const response = {
    success: false,
    code: error.statusCode,
    message: error.message,
    route: request.url,
    method: request.method,
    requestId: request.id || null,
  };
  // Log 404 errors
  logger.warn(`Error: ${response.message}`, response);
  reply.code(error.statusCode).send(response);
}

// default error handler
const errorHandler = (error, request, reply) => {
  const stack = serverConfig.IS_PRODUCTION
    ? "Check server logs for more details"
    : error.stack;

  let code = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
  let message = error.message || "Something went wrong";
  let setError = false;

  // Prisma validation errors
  if (error.name === "PrismaClientValidationError") {
    code = httpStatus.BAD_REQUEST;
    message = "Validation error";
    setError = true;
  }

  // Prisma unique constraint errors
  else if (error.code === "P2002") {
    code = httpStatus.BAD_REQUEST;
    message = "Data already exists (duplicate entry)";
    setError = true;
  }

  // Prisma record not found errors
  else if (error.code === "P2025") {
    code = httpStatus.NOT_FOUND;
    message = "Record not found";
    setError = true;
  }

  // JWT errors
  else if (error.name === "JsonWebTokenError") {
    code = httpStatus.UNAUTHORIZED;
    message = "Invalid token";
    setError = true;
  } else if (error.name === "TokenExpiredError") {
    code = httpStatus.UNAUTHORIZED;
    message = "Token expired";
    setError = true;
  }

  const response = {
    success: false,
    code,
    message,
    route: request.url,
    method: request.method,
    requestId: request.id || null,
    stack,
  };

  if (setError) {
    response.error = error.message;
  }

  const parseMessage = parseError(error);
  if (parseMessage) {
    response.message = parseMessage.message;
    response.error = parseMessage.error;
  }
  logger.error(`Error: ${message}`, { ...response, stack: error.stack, error });

  // Clear auth cookie on 401 Unauthorized errors
  if (code === httpStatus.UNAUTHORIZED) {
   logout(reply);
  }

  reply.code(code).send(response);
};

export { errorHandler, notFoundHandler };
