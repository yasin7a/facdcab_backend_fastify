// Usage Tracking Service
import { prisma } from "../lib/prisma.js";
import {
  getCurrentUTC,
  startOfDayUTC,
  endOfDayUTC,
} from "../utilities/dateUtils.js";

class UsageTrackingService {
  /**
   * Track feature usage for a user
   * @param {Object} params - Usage tracking parameters
   * @param {number} params.user_id - User ID
   * @param {number} params.subscription_id - Subscription ID
   * @param {string} params.feature_name - Feature name to track
   * @param {number} params.increment - Amount to increment (default: 1)
   * @returns {Object} Updated usage record
   */
  async trackUsage({ user_id, subscription_id, feature_name, increment = 1 }) {
    const now = getCurrentUTC();

    // Get subscription to determine billing cycle and period
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscription_id },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Use subscription start_date as period_start (aligned with billing cycle)
    const periodStart = startOfDayUTC(new Date(subscription.start_date));
    const periodEnd = new Date(subscription.end_date);

    // Find or create usage record
    const existingUsage = await prisma.featureUsage.findFirst({
      where: {
        user_id,
        subscription_id,
        feature_name,
        period_start: periodStart,
      },
    });

    if (existingUsage) {
      // Update existing usage
      const updatedUsage = await prisma.featureUsage.update({
        where: { id: existingUsage.id },
        data: {
          usage_count: {
            increment,
          },
        },
      });
      return updatedUsage;
    } else {
      // Create new usage record
      const newUsage = await prisma.featureUsage.create({
        data: {
          user_id,
          subscription_id,
          feature_name,
          usage_count: increment,
          period_start: periodStart,
          period_end: periodEnd,
        },
      });
      return newUsage;
    }
  }

  /**
   * Check if user has exceeded feature limit
   * @param {number} user_id - User ID
   * @param {string} feature_name - Feature name to check
   * @returns {Object} Usage status with limit information
   */
  async checkFeatureLimit(user_id, feature_name) {
    const now = getCurrentUTC();
    const periodStart = startOfDayUTC(now);

    // Optimized: Single query with all necessary includes
    const subscription = await prisma.subscription.findFirst({
      where: {
        user_id,
        status: "ACTIVE",
      },
      include: {
        usage: {
          where: {
            feature_name,
            period_start: periodStart,
          },
          take: 1,
        },
      },
    });

    if (!subscription) {
      return {
        allowed: false,
        reason: "No active subscription",
        usage: 0,
        limit: 0,
      };
    }

    // Get feature limit for the tier (separate query needed due to Prisma limitations)
    const tierFeature = await prisma.tierFeature.findFirst({
      where: {
        tier: subscription.tier,
        feature: {
          name: feature_name,
        },
        enabled: true,
      },
      include: {
        feature: true,
      },
    });

    if (!tierFeature) {
      return {
        allowed: false,
        reason: "Feature not available in your plan",
        usage: 0,
        limit: 0,
      };
    }

    // If no limit, feature is unlimited
    if (!tierFeature.limit) {
      return {
        allowed: true,
        reason: "Unlimited usage",
        usage: 0,
        limit: null,
      };
    }

    // Usage already fetched in subscription query
    const currentUsage = subscription.usage[0]?.usage_count || 0;
    const limit = tierFeature.limit;

    return {
      allowed: currentUsage < limit,
      reason: currentUsage < limit ? "Within limit" : "Limit exceeded",
      usage: currentUsage,
      limit,
      remaining: Math.max(0, limit - currentUsage),
    };
  }

  /**
   * Get usage statistics for a user
   * @param {number} user_id - User ID
   * @param {number} subscription_id - Subscription ID (optional)
   * @returns {Array} Usage statistics
   */
  async getUserUsageStats(user_id, subscription_id = null) {
    const where = {
      user_id,
    };

    if (subscription_id) {
      where.subscription_id = subscription_id;
    }

    const usageRecords = await prisma.featureUsage.findMany({
      where,
      orderBy: {
        created_at: "desc",
      },
    });

    return usageRecords;
  }

  /**
   * Reset usage for a new billing period
   * Called when subscription renews
   * @param {number} subscription_id - Subscription ID
   */
  async resetUsageForNewPeriod(subscription_id) {
    const now = getCurrentUTC();
    const periodStart = startOfDayUTC(now);

    // Archive old usage records (mark them as ended)
    await prisma.featureUsage.updateMany({
      where: {
        subscription_id,
        period_end: {
          lt: now,
        },
      },
      data: {
        period_end: now,
      },
    });

    console.log(
      `[UsageTracking] Reset usage for subscription ${subscription_id} at ${periodStart}`,
    );

    return { reset: true, period_start: periodStart };
  }

  /**
   * Middleware to check and track feature usage
   * @param {string} feature_name - Feature name
   * @returns {Function} Fastify middleware
   */
  checkAndTrackUsage(feature_name) {
    return async (request, reply) => {
      const user_id = request.auth_id;

      if (!user_id) {
        throw new Error("User not authenticated");
      }

      const limitCheck = await this.checkFeatureLimit(user_id, feature_name);

      if (!limitCheck.allowed) {
        reply.code(429).send({
          success: false,
          message: `Feature limit exceeded: ${limitCheck.reason}`,
          usage: limitCheck.usage,
          limit: limitCheck.limit,
        });
        return;
      }

      // Get subscription for tracking
      const subscription = await prisma.subscription.findFirst({
        where: {
          user_id,
          status: "ACTIVE",
        },
      });

      if (subscription) {
        await this.trackUsage({
          user_id,
          subscription_id: subscription.id,
          feature_name,
          increment: 1,
        });
      }

      request.featureUsage = limitCheck;
    };
  }
}

export default UsageTrackingService;
