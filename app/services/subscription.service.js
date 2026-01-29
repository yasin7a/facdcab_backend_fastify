// Subscription Service
import { prisma } from "../lib/prisma.js";
import serverConfig from "../../config/server.config.js";

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
   * Calculate subscription dates based on billing cycle
   */
  calculateDates(billing_cycle) {
    const start_date = new Date();
    const end_date = new Date(start_date);

    switch (billing_cycle) {
      case "MONTHLY":
        end_date.setMonth(end_date.getMonth() + 1);
        break;
      case "SIX_MONTHLY":
        end_date.setMonth(end_date.getMonth() + 6);
        break;
      case "YEARLY":
        end_date.setFullYear(end_date.getFullYear() + 1);
        break;
      case "LIFETIME":
        // Set to 100 years in the future for lifetime access
        end_date.setFullYear(end_date.getFullYear() + 100);
        break;
    }

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
   */
  calculateProration(currentSubscription, currentPricing, newPricing) {
    const now = new Date();
    const startDate = new Date(currentSubscription.start_date);
    const endDate = new Date(currentSubscription.end_date);

    // Calculate total and remaining days
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const daysUsed = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 0) {
      return {
        credit: 0,
        charge: parseFloat(newPricing.price),
        daysRemaining: 0,
        netAmount: parseFloat(newPricing.price),
      };
    }

    // Calculate credit for unused time on current plan
    const credit =
      (daysRemaining / totalDays) * parseFloat(currentPricing.price);

    // Calculate prorated charge for new plan (only for remaining days)
    const charge = (daysRemaining / totalDays) * parseFloat(newPricing.price);

    // Net amount user needs to pay
    const netAmount = Math.max(0, charge - credit);

    return {
      credit: parseFloat(credit.toFixed(2)),
      charge: parseFloat(charge.toFixed(2)),
      daysRemaining,
      totalDays,
      daysUsed,
      netAmount: parseFloat(netAmount.toFixed(2)),
      refundAmount:
        credit > charge ? parseFloat((credit - charge).toFixed(2)) : 0,
    };
  }
}

export default SubscriptionService;
