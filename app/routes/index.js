import baseRoute from "./base.js";
import adminRoutes from "./admin.js";
import testRoutes from "./test.js";
import userRoutes from "./user.js";

async function routes(fastify, options) {
  // Register user routes
  fastify.register(userRoutes, { prefix: "/user" });

  // Register admin routes
  fastify.register(adminRoutes, { prefix: "/admin" });
  // Register base routes
  fastify.register(baseRoute, { prefix: "/base" });

  // Register test routes
  fastify.register(testRoutes, { prefix: "/test" });
}

export default routes;
