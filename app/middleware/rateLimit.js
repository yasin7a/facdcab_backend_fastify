import throwError from "../utilities/throwError.js";
import httpStatus from "../utilities/httpStatus.js";

// Global rate limiter
const rateLimiter = async (app, maxRequests = 500, windowMsMinutes = 15) => {
  const rateLimit = await import("@fastify/rate-limit");
  await app.register(rateLimit.default, {
    global: true,
    max: maxRequests,
    timeWindow: windowMsMinutes * 60 * 1000,
    errorResponseBuilder: (request, context) => {
      return throwError(
        httpStatus.TOO_MANY_REQUESTS,
        "Too many requests, please try again later."
      );
    },
  });
};

// Route-specific rate limiter
const createRouteLimiter = async (
  fastify,
  maxRequests = 20,
  windowMsMinutes = 5
) => {
  const rateLimit = await import("@fastify/rate-limit");
  await fastify.register(rateLimit.default, {
    max: maxRequests,
    timeWindow: windowMsMinutes * 60 * 1000,
    errorResponseBuilder: (request, context) => {
      return throwError(
        httpStatus.TOO_MANY_REQUESTS,
        "Too many requests, please try again later."
      );
    },
  });
};

export default rateLimiter;
export { createRouteLimiter };
