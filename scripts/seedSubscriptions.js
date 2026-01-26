// Seed subscription data
import { prisma } from "../app/lib/prisma.js";

async function seedSubscriptionData() {
  console.log("🌱 Seeding subscription data...");

  try {
    // 1. Seed Subscription Prices
    console.log("Creating subscription prices...");
    const prices = await prisma.subscriptionPrice.createMany({
      data: [
        // GOLD Plans
        {
          tier: "GOLD",
          billing_cycle: "MONTHLY",
          price: 9.99,
          currency: "USD",
          active: true,
        },
        {
          tier: "GOLD",
          billing_cycle: "SIX_MONTHLY",
          price: 54.99,
          currency: "USD",
          active: true,
        },
        {
          tier: "GOLD",
          billing_cycle: "YEARLY",
          price: 99.99,
          currency: "USD",
          active: true,
        },

        // PLATINUM Plans
        {
          tier: "PLATINUM",
          billing_cycle: "MONTHLY",
          price: 19.99,
          currency: "USD",
          active: true,
        },
        {
          tier: "PLATINUM",
          billing_cycle: "SIX_MONTHLY",
          price: 109.99,
          currency: "USD",
          active: true,
        },
        {
          tier: "PLATINUM",
          billing_cycle: "YEARLY",
          price: 199.99,
          currency: "USD",
          active: true,
        },

        // DIAMOND Plans
        {
          tier: "DIAMOND",
          billing_cycle: "MONTHLY",
          price: 49.99,
          currency: "USD",
          active: true,
        },
        {
          tier: "DIAMOND",
          billing_cycle: "SIX_MONTHLY",
          price: 274.99,
          currency: "USD",
          active: true,
        },
        {
          tier: "DIAMOND",
          billing_cycle: "YEARLY",
          price: 499.99,
          currency: "USD",
          active: true,
        },
        {
          tier: "GOLD",
          billing_cycle: "LIFETIME",
          price: 999.99,
          currency: "USD",
          active: true,
        },
        {
          tier: "PLATINUM",
          billing_cycle: "LIFETIME",
          price: 1999.99,
          currency: "USD",
          active: true,
        },
        {
          tier: "DIAMOND",
          billing_cycle: "LIFETIME",
          price: 4999.99,
          currency: "USD",
          active: true,
        },
      ],
      skipDuplicates: true,
    });
    console.log(`✅ Created ${prices.count} subscription prices`);

    // 2. Seed Features
    console.log("Creating features...");
    const featureData = [
      {
        name: "basic_support",
        description: "Email support within 48 hours",
      },
      {
        name: "priority_support",
        description: "Priority email support within 24 hours",
      },
      {
        name: "premium_support",
        description: "24/7 chat and phone support",
      },
      {
        name: "api_access",
        description: "Access to REST API",
      },
      {
        name: "advanced_analytics",
        description: "Advanced analytics and reporting",
      },
      {
        name: "custom_branding",
        description: "Custom branding and white-label options",
      },
      {
        name: "team_collaboration",
        description: "Team collaboration features",
      },
      {
        name: "export_data",
        description: "Export data in multiple formats",
      },
    ];

    const features = [];
    for (const feature of featureData) {
      const created = await prisma.feature.upsert({
        where: { name: feature.name },
        update: {},
        create: feature,
      });
      features.push(created);
    }
    console.log(`✅ Created ${features.length} features`);

    // 3. Seed Tier Features (Feature Access by Tier)
    console.log("Creating tier-feature mappings...");
    const tierFeatures = [
      // GOLD Features
      {
        tier: "GOLD",
        featureName: "basic_support",
        enabled: true,
        limit: null,
      },
      { tier: "GOLD", featureName: "api_access", enabled: true, limit: 1000 }, // 1000 API calls/month
      { tier: "GOLD", featureName: "export_data", enabled: true, limit: 10 }, // 10 exports/month

      // PLATINUM Features (includes all GOLD + more)
      {
        tier: "PLATINUM",
        featureName: "basic_support",
        enabled: true,
        limit: null,
      },
      {
        tier: "PLATINUM",
        featureName: "priority_support",
        enabled: true,
        limit: null,
      },
      {
        tier: "PLATINUM",
        featureName: "api_access",
        enabled: true,
        limit: 10000,
      }, // 10k API calls/month
      {
        tier: "PLATINUM",
        featureName: "advanced_analytics",
        enabled: true,
        limit: null,
      },
      {
        tier: "PLATINUM",
        featureName: "team_collaboration",
        enabled: true,
        limit: 5,
      }, // 5 team members
      {
        tier: "PLATINUM",
        featureName: "export_data",
        enabled: true,
        limit: 50,
      }, // 50 exports/month

      // DIAMOND Features (includes all PLATINUM + more)
      {
        tier: "DIAMOND",
        featureName: "basic_support",
        enabled: true,
        limit: null,
      },
      {
        tier: "DIAMOND",
        featureName: "priority_support",
        enabled: true,
        limit: null,
      },
      {
        tier: "DIAMOND",
        featureName: "premium_support",
        enabled: true,
        limit: null,
      },
      {
        tier: "DIAMOND",
        featureName: "api_access",
        enabled: true,
        limit: null,
      }, // Unlimited
      {
        tier: "DIAMOND",
        featureName: "advanced_analytics",
        enabled: true,
        limit: null,
      },
      {
        tier: "DIAMOND",
        featureName: "custom_branding",
        enabled: true,
        limit: null,
      },
      {
        tier: "DIAMOND",
        featureName: "team_collaboration",
        enabled: true,
        limit: null,
      }, // Unlimited team
      {
        tier: "DIAMOND",
        featureName: "export_data",
        enabled: true,
        limit: null,
      }, // Unlimited exports
    ];

    let tierFeatureCount = 0;
    for (const tf of tierFeatures) {
      const feature = features.find((f) => f.name === tf.featureName);
      if (feature) {
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
      }
    }
    console.log(`✅ Created ${tierFeatureCount} tier-feature mappings`);

    // 4. Seed Sample Coupons
    console.log("Creating sample coupons...");
    const coupons = await prisma.coupon.createMany({
      data: [
        {
          code: "WELCOME20",
          type: "PERCENTAGE",
          discount_value: 20,
          max_uses: 1000,
          max_uses_per_user: 1,
          is_active: true,
          purchase_types: ["SUBSCRIPTION", "PRODUCT"],
        },
        {
          code: "SAVE10",
          type: "FIXED",
          discount_value: 10,
          min_purchase_amount: 50,
          max_uses: 500,
          max_uses_per_user: 1,
          is_active: true,
        },
        {
          code: "YEARLYSPECIAL",
          type: "PERCENTAGE",
          discount_value: 25,
          applicable_cycles: ["YEARLY"],
          max_uses: 200,
          is_active: true,
        },
        {
          code: "FREETRIAL",
          type: "FREE_TRIAL",
          discount_value: 100,
          applicable_tiers: ["GOLD"],
          applicable_cycles: ["MONTHLY"],
          max_uses_per_user: 1,
          is_active: true,
        },
      ],
      skipDuplicates: true,
    });
    console.log(`✅ Created ${coupons.count} coupons`);

    console.log("\n✨ Subscription data seeded!");
  } catch (error) {
    console.error("❌ Error seeding subscription data:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed
seedSubscriptionData().catch((error) => {
  console.error(error);
  process.exit(1);
});
