import { createRouteLimiter } from "../middleware/rateLimit.js";
import turnstileWidget from "../middleware/turnstileWidget.js";
import verifyAuth from "../middleware/verifyAuth.js";
import verifyUserAccount from "../middleware/verifyUserAccount.js";
import authUserController from "../modules/user/auth/auth.controller.js";
import userProfileController from "../modules/user/profile/profile.controller.js";
import { UserType } from "../utilities/constant.js";

async function userRoutes(fastify, options) {
  // Auth routes with rate limiting and turnstile
  fastify.register(
    async (fastify) => {
      await createRouteLimiter(fastify, 20, 5);
      fastify.addHook("preHandler", turnstileWidget);
      fastify.register(authUserController);
    },
    { prefix: "/auth" }
  );

  // Protected profile routes
  fastify.register(async (fastify) => {
    fastify.addHook("preHandler", verifyAuth);
    fastify.addHook(
      "preHandler",
      verifyUserAccount({ model: "user", type: [UserType.USER] })
    );

    // routes
    fastify.register(userProfileController, { prefix: "/profile" });
  });
}

export default userRoutes;
