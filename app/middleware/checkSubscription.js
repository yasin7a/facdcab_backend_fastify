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

    // Get user's most recent subscription (single query)
    const latestSubscription = await prisma.subscription.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });

    // Check if subscription is active
    const isActive =
      latestSubscription &&
      latestSubscription.status === SubscriptionStatus.ACTIVE &&
      (latestSubscription.end_date === null ||
        new Date(latestSubscription.end_date) > new Date());

    // If subscription is required but user doesn't have an active one
    if (requireSubscription && !isActive) {
      if (latestSubscription) {
        // User had a subscription but it expired or was cancelled
        throw throwError({
          statusCode: httpStatus.BAD_REQUEST,
          message:
            "Your subscription has ended. Please renew your subscription to continue accessing this feature.",
        });
      } else {
        // User never had a subscription
        throw throwError({
          statusCode: httpStatus.BAD_REQUEST,
          message:
            "This feature requires an active subscription. Please subscribe to access this feature.",
        });
      }
    }

    // Attach subscription info to request for use in controllers
    request.user_subscription = isActive ? latestSubscription : null;
    request.is_proMember = isActive;
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
//        throw throwError({
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
//        throw throwError({
//         statusCode: httpStatus.FORBIDDEN,
//         message: `This feature requires ${tiersList} subscription tier. Please upgrade your subscription.`,
//       });
//     }

//     // Attach subscription info to request
//     request.user_subscription = activeSubscription;
//     request.is_proMember = true;
//   };
// };

export { checkSubscription };
// export { checkSubscription, checkSubscriptionTier };
