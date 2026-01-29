// Subscription Service
import { prisma } from "../lib/prisma.js";
import serverConfig from "../../config/server.config.js";
import {
  getCurrentUTC,
  calculateEndDate,
  daysBetween,
} from "../utilities/dateUtils.js";

class SubscriptionService {
  /**
   * Get pricing for a tier and billing cycle
   */
  async getPricing(tier, billing_cycle, currency = null) {
    const pricing = await prisma.subscriptionPrice.findFirst({
      where: {
        tier,
        billing_cycle,
        currency: currency || serverConfig.CURRENCY,
        active: true,
      },
    });

    return pricing;
  }

  /**
   * Calculate subscription dates based on billing cycle (timezone-aware)
   */
  calculateDates(billing_cycle) {
    const start_date = getCurrentUTC();
    const end_date = calculateEndDate(start_date, billing_cycle);

    return {
      startDate: start_date,
      endDate: end_date,
      autoRenew: billing_cycle !== "LIFETIME", // Lifetime subscriptions don't auto-renew
    };
  }

  /**
   * Get features for a subscription tier
   */
  async getSubscriptionFeatures(tier) {
    // Tier hierarchy: GOLD < PLATINUM < DIAMOND
    const tierHierarchy = {
      GOLD: ["GOLD"],
      PLATINUM: ["GOLD", "PLATINUM"],
      DIAMOND: ["GOLD", "PLATINUM", "DIAMOND"],
    };

    const accessibleTiers = tierHierarchy[tier] || [];

    const features = await prisma.tierFeature.findMany({
      where: {
        tier: { in: accessibleTiers },
        enabled: true,
      },
      include: {
        feature: true,
      },
    });

    return features.map((tf) => ({
      id: tf.feature.id,
      name: tf.feature.name,
      description: tf.feature.description,
      tier: tf.tier,
      limit: tf.limit,
      enabled: tf.enabled,
    }));
  }

  /**
   * Check if user has access to a specific feature
   */
  async checkFeatureAccess(tier, status, featureName) {
    if (status !== "ACTIVE") {
      return {
        hasAccess: false,
        reason: "Subscription is not active",
      };
    }

    const tierHierarchy = {
      GOLD: ["GOLD"],
      PLATINUM: ["GOLD", "PLATINUM"],
      DIAMOND: ["GOLD", "PLATINUM", "DIAMOND"],
    };

    const accessibleTiers = tierHierarchy[tier] || [];

    const feature = await prisma.feature.findUnique({
      where: { name: featureName },
      include: {
        tiers: {
          where: {
            tier: { in: accessibleTiers },
            enabled: true,
          },
        },
      },
    });

    if (!feature) {
      return {
        hasAccess: false,
        reason: "Feature not found",
      };
    }

    const hasAccess = feature.tiers.length > 0;

    return {
      hasAccess,
      feature: hasAccess ? feature : null,
      limit: hasAccess ? feature.tiers[0].limit : null,
    };
  }

  /**
   * Auto-renew subscription
   */
  async renewSubscription(subscriptionId) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true },
    });

    if (!subscription || !subscription.auto_renew) {
      return null;
    }

    // Calculate new dates
    const dates = this.calculateDates(subscription.billing_cycle);

    // Update subscription
    const renewed = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        start_date: dates.startDate,
        end_date: dates.endDate,
        status: "PENDING", // Will be ACTIVE after payment
      },
    });

    return renewed;
  }

  /**
   * Check and expire subscriptions
   */
  async checkExpiredSubscriptions() {
    const now = new Date();

    const expiredSubscriptions = await prisma.subscription.updateMany({
      where: {
        end_date: { lt: now },
        status: "ACTIVE",
      },
      data: {
        status: "EXPIRED",
      },
    });

    return expiredSubscriptions;
  }

  /**
   * Calculate proration for subscription changes
   * Returns credit for unused time and charge for new plan
   * Handles edge cases: last day changes, negative amounts, rounding errors
   */
  calculateProration(currentSubscription, currentPricing, newPricing) {
    const now = getCurrentUTC();
    const startDate = new Date(currentSubscription.start_date);
    const endDate = new Date(currentSubscription.end_date);

    // Calculate total and remaining days using timezone-aware utility
    const totalDays = Math.max(1, daysBetween(startDate, endDate)); // Prevent division by zero
    const daysUsed = daysBetween(startDate, now);
    const daysRemaining = daysBetween(now, endDate);

    // Edge case: subscription already expired or on last day
    if (daysRemaining <= 0) {
      return {
        credit: 0,
        charge: parseFloat(newPricing.price),
        daysRemaining: 0,
        totalDays,
        daysUsed: totalDays,
        netAmount: parseFloat(newPricing.price),
        refundAmount: 0,
        isNewBillingCycle: true,
      };
    }

    // Edge case: same day change (less than 1 day remaining)
    if (daysRemaining < 1) {
      return {
        credit: 0,
        charge: parseFloat(newPricing.price),
        daysRemaining: 0,
        totalDays,
        daysUsed: totalDays,
        netAmount: parseFloat(newPricing.price),
        refundAmount: 0,
        isNewBillingCycle: true,
      };
    }

    // Calculate credit for unused time on current plan
    const creditRatio = daysRemaining / totalDays;
    const credit = creditRatio * parseFloat(currentPricing.price);

    // Calculate prorated charge for new plan (only for remaining days)
    const charge = creditRatio * parseFloat(newPricing.price);

    // Net amount user needs to pay (with minimum charge of $0.50 to avoid micro-transactions)
    let netAmount = charge - credit;

    // Handle rounding errors (amounts less than $0.01)
    if (Math.abs(netAmount) < 0.01) {
      netAmount = 0;
    }

    // Ensure minimum charge for upgrades
    if (netAmount > 0 && netAmount < 0.5) {
      netAmount = 0.5;
    }

    const finalNetAmount = Math.max(0, netAmount);
    const refundAmount = credit > charge ? credit - charge : 0;

    return {
      credit: parseFloat(credit.toFixed(2)),
      charge: parseFloat(charge.toFixed(2)),
      daysRemaining,
      totalDays,
      daysUsed,
      netAmount: parseFloat(finalNetAmount.toFixed(2)),
      refundAmount: parseFloat(refundAmount.toFixed(2)),
      isNewBillingCycle: false,
    };
  }
}

export default SubscriptionService;
