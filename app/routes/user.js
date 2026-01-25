import { createRouteLimiter } from "../middleware/rateLimit.js";
import turnstileWidget from "../middleware/turnstileWidget.js";
import verifyAuth from "../middleware/verifyAuth.js";
import verifyUserAccount from "../middleware/verifyUserAccount.js";
import authUserController from "../modules/user/auth/auth.controller.js";
import userProfileController from "../modules/user/profile/profile.controller.js";
import subscriptionController from "../modules/user/subscription/subscription.controller.js";
import paymentController from "../modules/user/payment/payment.controller.js";
import invoiceController from "../modules/user/invoice/invoice.controller.js";
// Event controllers
import userEventController from "../modules/user/event/event.controller.js";
import userStallBookingController from "../modules/user/event/stall-booking.controller.js";
import userSponsorshipController from "../modules/user/event/sponsorship.controller.js";
import { UserType } from "../utilities/constant.js";

async function userRoutes(fastify, options) {
  // Auth routes with rate limiting and turnstile
  fastify.register(
    async (fastify) => {
      await createRouteLimiter(fastify, 20, 5);
      fastify.addHook("preHandler", turnstileWidget);
      fastify.register(authUserController);
    },
    { prefix: "/auth" },
  );

  // Protected profile routes
  fastify.register(async (fastify) => {
    fastify.addHook("preHandler", verifyAuth);
    fastify.addHook(
      "preHandler",
      verifyUserAccount({ model: "user", type: [UserType.USER] }),
    );

    // routes
    fastify.register(userProfileController, { prefix: "/profile" });
    fastify.register(subscriptionController, { prefix: "/subscriptions" });
    fastify.register(paymentController, { prefix: "/payments" });
    fastify.register(invoiceController, { prefix: "/invoices" });
    // Event routes
    fastify.register(userStallBookingController, {
      prefix: "/event-stall-bookings",
    });
    fastify.register(userSponsorshipController, { prefix: "/events-sponsorships" });
  });

  // Public event routes (no auth required)
  fastify.register(userEventController, { prefix: "/events" });
}

export default userRoutes;
