// Seed subscription data
import { prisma } from "../app/lib/prisma.js";
import { BillingCycle, SubscriptionTier } from "../app/utilities/constant.js";
const CURRENCY = "BDT";
async function seedSubscriptionData() {
  console.log("Seeding subscription data...");

  // 1. Seed Subscription Prices
  console.log("Creating subscription prices...");
  const priceData = [
    // GOLD YEARLY Plan
    {
      tier: SubscriptionTier.GOLD,
      billing_cycle: BillingCycle.YEARLY,
      price: 6000,
      setup_fee: 31000,
      currency: CURRENCY,
      active: true,
      region: null,
    },
  ];

  let priceCount = 0;
  for (const priceItem of priceData) {
    try {
      await prisma.subscriptionPrice.upsert({
        where: {
          tier_billing_cycle_currency_region: {
            tier: priceItem.tier,
            billing_cycle: priceItem.billing_cycle,
            currency: priceItem.currency,
            region: priceItem.region,
          },
        },
        update: {
          price: priceItem.price,
          setup_fee: priceItem.setup_fee,
          active: priceItem.active,
        },
        create: priceItem,
      });
      priceCount++;
    } catch (error) {
      console.log(
        `ℹ️ Error upserting price for ${priceItem.tier} ${priceItem.billing_cycle}: ${error.message}`,
      );
    }
  }
  console.log(`✅ Processed ${priceCount} subscription prices`);

  // 2. Seed Features
  console.log("Creating features...");
  const featureData = [
    {
      name: "basic_support",
      description: "Email support within 48 hours",
    },
    {
      name: "api_access",
      description: "Access to REST API",
    },
    {
      name: "export_data",
      description: "Export data in multiple formats",
    },
    {
      name: "team_collaboration",
      description: "Team collaboration features",
    },
    {
      name: "advanced_analytics",
      description: "Advanced analytics and reporting",
    },
  ];

  const features = [];
  for (const feature of featureData) {
    try {
      const created = await prisma.feature.upsert({
        where: { name: feature.name },
        update: {},
        create: feature,
      });
      features.push(created);
    } catch (error) {
      console.log(
        `ℹ️ Feature ${feature.name} already exists or error: ${error.message}`,
      );
    }
  }
  console.log(`✅ Processed ${features.length} features`);

  // 3. Seed Tier Features (GOLD only)
  console.log("Creating tier-feature mappings for GOLD...");
  const tierFeatures = [
    {
      tier: SubscriptionTier.GOLD,
      featureName: "basic_support",
      enabled: true,
      limit: null,
    },
    {
      tier: SubscriptionTier.GOLD,
      featureName: "api_access",
      enabled: true,
      limit: 1000,
    }, // 1000 API calls/month
    {
      tier: SubscriptionTier.GOLD,
      featureName: "export_data",
      enabled: true,
      limit: 10,
    }, // 10 exports/month
    {
      tier: SubscriptionTier.GOLD,
      featureName: "team_collaboration",
      enabled: true,
      limit: 5,
    }, // 5 team members
    {
      tier: SubscriptionTier.GOLD,
      featureName: "advanced_analytics",
      enabled: true,
      limit: null,
    },
  ];

  let tierFeatureCount = 0;
  for (const tf of tierFeatures) {
    const feature = features.find((f) => f.name === tf.featureName);
    if (feature) {
      try {
        await prisma.tierFeature.upsert({
          where: {
            tier_feature_id: {
              tier: tf.tier,
              feature_id: feature.id,
            },
          },
          update: {
            enabled: tf.enabled,
            limit: tf.limit,
          },
          create: {
            tier: tf.tier,
            feature_id: feature.id,
            enabled: tf.enabled,
            limit: tf.limit,
          },
        });
        tierFeatureCount++;
      } catch (error) {
        console.log(
          `ℹ️ Tier feature ${tf.featureName} for ${tf.tier} already exists or error: ${error.message}`,
        );
      }
    }
  }
  console.log(`✅ Processed ${tierFeatureCount} tier-feature mappings`);

  console.log("\n✨ Subscription data seeding completed!");
}

// Run seed
seedSubscriptionData().catch((error) => {
  console.error("❌ Seeding failed:", error.message);
});
// .finally(async () => {
//   await prisma.$disconnect();
// });
