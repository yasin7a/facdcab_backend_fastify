import { prisma } from "../lib/prisma.js";
import { SubscriptionStatus, SubscriptionTier } from "../utilities/constant.js";
import throwError from "../utilities/throwError.js";
import httpStatus from "../utilities/httpStatus.js";

/**
 * Middleware to check if user has an active subscription
 * Free users (no subscription) can only update their profile
 * Pro users (GOLD, PLATINUM, DIAMOND) can access all features
 */
const checkSubscription = (options = {}) => {
  const { requireSubscription = true } = options;

  return async (request, reply) => {
    const userId = request?.auth_id;

    if (!userId) {
      throwError({
        statusCode: httpStatus.UNAUTHORIZED,
        message: "User not authenticated",
      });
    }

    // Get user's active subscription
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        user_id: userId,
        status: SubscriptionStatus.ACTIVE,
        OR: [{ ends_at: { gt: new Date() } }, { ends_at: null }],
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // If subscription is required but user doesn't have an active one
    if (requireSubscription && !activeSubscription) {
      // Check if user ever had a subscription
      const anySubscription = await prisma.subscription.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
      });

      if (anySubscription) {
        // User had a subscription but it expired or was cancelled
        throwError({
          statusCode: httpStatus.BAD_REQUEST,
          message:
            "Your subscription has ended. Please renew your subscription to continue accessing this feature.",
        });
      } else {
        // User never had a subscription
        throwError({
          statusCode: httpStatus.BAD_REQUEST,
          message:
            "This feature requires an active subscription. Please subscribe to GOLD, PLATINUM, or DIAMOND tier to access this feature.",
        });
      }
    }

    // Attach subscription info to request for use in controllers
    request.userSubscription = activeSubscription || null;
    request.isProMember = !!activeSubscription;
  };
};

/**
 * Middleware to check if user has a specific tier or higher
 * Usage example in routes:
 *
 * fastify.addHook("preHandler", checkSubscriptionTier([SubscriptionTier.PLATINUM, SubscriptionTier.DIAMOND]));
 */
// const checkSubscriptionTier = (requiredTiers = []) => {
//   return async (request, reply) => {
//     const userId = request?.auth_id;

//     if (!userId) {
//       throwError({
//         statusCode: httpStatus.UNAUTHORIZED,
//         message: "User not authenticated",
//       });
//     }

//     // Get user's active subscription
//     const activeSubscription = await prisma.subscription.findFirst({
//       where: {
//         user_id: userId,
//         status: SubscriptionStatus.ACTIVE,
//         OR: [{ ends_at: { gt: new Date() } }, { ends_at: null }],
//       },
//       orderBy: {
//         created_at: "desc",
//       },
//     });

//     // Check if user has required tier
//     if (
//       !activeSubscription ||
//       !requiredTiers.includes(activeSubscription.tier)
//     ) {
//       const tiersList = requiredTiers.join(", ");
//       throwError({
//         statusCode: httpStatus.FORBIDDEN,
//         message: `This feature requires ${tiersList} subscription tier. Please upgrade your subscription.`,
//       });
//     }

//     // Attach subscription info to request
//     request.userSubscription = activeSubscription;
//     request.isProMember = true;
//   };
// };

export { checkSubscription };
// export { checkSubscription, checkSubscriptionTier };
