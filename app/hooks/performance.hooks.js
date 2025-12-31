import logger from "../middleware/logging.js";

const SLOW_REQUEST_THRESHOLD = 1000;

export function registerPerformanceHooks(app) {
  app.addHook("onRequest", async (request, reply) => {
    request.startTime = process.hrtime.bigint();
  });

  app.addHook("onResponse", async (request, reply) => {
    const duration =
      Number(process.hrtime.bigint() - request.startTime) / 1000000;

    if (duration > SLOW_REQUEST_THRESHOLD) {
      logger.warn(
        `Slow request detected: ${request.method} ${
          request.url
        } took ${duration.toFixed(2)} ms`,
        {
          code: reply.statusCode,
          message: `Request exceeded ${SLOW_REQUEST_THRESHOLD}ms threshold, took ${duration.toFixed(
            2
          )} ms`,
          route: request.url,
          method: request.method,
          requestId: request.id || null,
        }
      );
    }
  });
}

export default registerPerformanceHooks;
