import { createRouteLimiter } from "../middleware/rateLimit.js";
import turnstileWidget from "../middleware/turnstileWidget.js";
import verifyAuth from "../middleware/verifyAuth.js";
import verifyUserAccount from "../middleware/verifyUserAccount.js";
import { checkSubscription } from "../middleware/checkSubscription.js";
import authUserController from "../modules/user/auth/auth.controller.js";
import userProfileController from "../modules/user/profile/profile.controller.js";
import subscriptionController from "../modules/user/subscription/subscription.controller.js";
import paymentController from "../modules/user/payment/payment.controller.js";
import invoiceController from "../modules/user/invoice/invoice.controller.js";
import userEventController from "../modules/user/event/event.controller.js";
import userStallBookingController from "../modules/user/event/stall-booking.controller.js";
import userSponsorshipController from "../modules/user/event/sponsorship.controller.js";
import organizationController from "../modules/user/organization/organization.controller.js";
import recommendationController from "../modules/user/organization/recommendation.controller.js";
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

  // Protected routes - Profile (available to all users, even without subscription)
  fastify.register(async (fastify) => {
    fastify.addHook("preHandler", verifyAuth);
    fastify.addHook(
      "preHandler",
      verifyUserAccount({ model: "user", type: [UserType.USER] }),
    );

    fastify.register(userProfileController, { prefix: "/profile" });
    fastify.register(organizationController, { prefix: "/organization" });
    fastify.register(recommendationController, {
      prefix: "/recommendation",
    });
  });

  // Protected routes - Subscription management (available to all users)
  fastify.register(async (fastify) => {
    fastify.addHook("preHandler", verifyAuth);
    fastify.addHook(
      "preHandler",
      verifyUserAccount({ model: "user", type: [UserType.USER] }),
    );

    fastify.register(subscriptionController, { prefix: "/subscription" });
    fastify.register(paymentController, { prefix: "/payment" });
    fastify.register(invoiceController, { prefix: "/invoice" });
  });

  // Protected routes - Event features (require active subscription)
  fastify.register(async (fastify) => {
    fastify.addHook("preHandler", verifyAuth);
    fastify.addHook(
      "preHandler",
      verifyUserAccount({ model: "user", type: [UserType.USER] }),
    );
    fastify.addHook(
      "preHandler",
      checkSubscription({ requireSubscription: true }),
    );

    fastify.register(userStallBookingController, {
      prefix: "/event-stall-bookings",
    });
    fastify.register(userSponsorshipController, {
      prefix: "/events-sponsorships",
    });
  });

  // ============================================================
  // TIER-BASED ACCESS EXAMPLES (for future implementation)
  // ============================================================
  // Uncomment checkSubscriptionTier in checkSubscription.js first
  // Then import: import { checkSubscriptionTier } from "../middleware/checkSubscription.js";
  // Also import: import { SubscriptionTier } from "../utilities/constant.js";

  // Example 1: Feature only for PLATINUM and DIAMOND users
  // fastify.register(async (fastify) => {
  //   fastify.addHook("preHandler", verifyAuth);
  //   fastify.addHook("preHandler", verifyUserAccount({ model: "user", type: [UserType.USER] }));
  //   fastify.addHook("preHandler", checkSubscriptionTier([SubscriptionTier.PLATINUM, SubscriptionTier.DIAMOND]));
  //
  //   fastify.register(advancedAnalyticsController, { prefix: "/analytics" });
  // });

  // Example 2: Feature only for DIAMOND users (highest tier)
  // fastify.register(async (fastify) => {
  //   fastify.addHook("preHandler", verifyAuth);
  //   fastify.addHook("preHandler", verifyUserAccount({ model: "user", type: [UserType.USER] }));
  //   fastify.addHook("preHandler", checkSubscriptionTier([SubscriptionTier.DIAMOND]));
  //
  //   fastify.register(premiumSupportController, { prefix: "/premium-support" });
  // });

  // Example 3: Feature for all paid tiers (GOLD, PLATINUM, DIAMOND)
  // fastify.register(async (fastify) => {
  //   fastify.addHook("preHandler", verifyAuth);
  //   fastify.addHook("preHandler", verifyUserAccount({ model: "user", type: [UserType.USER] }));
  //   fastify.addHook("preHandler", checkSubscriptionTier([SubscriptionTier.GOLD, SubscriptionTier.PLATINUM, SubscriptionTier.DIAMOND]));
  //
  //   fastify.register(reportController, { prefix: "/reports" });
  // });

  // Public event routes (no auth required)
  fastify.register(userEventController, { prefix: "/events" });
}

export default userRoutes;
