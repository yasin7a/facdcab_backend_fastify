import { auth, authHandler } from "../../config/auth.config.js";

/**
 * Better Auth Fastify Plugin
 * Handles all authentication routes and middleware
 */
async function betterAuthPlugin(fastify, options) {
  // Create a custom route handler that converts Fastify request to standard Request
  fastify.all("/auth/*", async (request, reply) => {
    try {
      // Convert Fastify request to Web Request format
      const url = new URL(
        request.url,
        `${request.protocol}://${request.hostname}`,
      );

      // Build headers
      const headers = new Headers();
      Object.keys(request.headers).forEach((key) => {
        const value = request.headers[key];
        if (value) {
          headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
      });

      // Create Web Request object
      const webRequest = new Request(url, {
        method: request.method,
        headers,
        body:
          request.method !== "GET" && request.method !== "HEAD"
            ? JSON.stringify(request.body)
            : undefined,
      });

      // Call Better Auth handler
      const response = await authHandler(webRequest);

      // Convert response back to Fastify response
      reply.code(response.status);

      // Set response headers
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      // Send response body
      const responseBody = await response.text();

      // Try to parse as JSON, otherwise send as text
      try {
        const jsonBody = JSON.parse(responseBody);
        return reply.send(jsonBody);
      } catch {
        return reply
          .type(response.headers.get("content-type") || "text/plain")
          .send(responseBody);
      }
    } catch (error) {
      fastify.log.error("Better Auth error:", error);
      return reply.code(500).send({
        error: "Authentication error",
        message: error.message,
      });
    }
  });

  // Decorate Fastify with auth utilities
  fastify.decorate("auth", auth);

  fastify.log.info("✅ Better Auth plugin registered");
}

export default betterAuthPlugin;
