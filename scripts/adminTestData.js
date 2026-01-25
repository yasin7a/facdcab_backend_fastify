// Admin Test Data - Sample requests for testing admin endpoints
// Copy these into Postman or use with curl

export const adminTestData = {
  // COUPONS
  coupons: {
    percentage: {
      code: "SAVE20",
      type: "PERCENTAGE",
      discount_value: 20.0,
      max_uses: 100,
      max_uses_per_user: 1,
      is_active: true,
      applicable_tiers: ["GOLD", "PLATINUM", "DIAMOND"],
      applicable_cycles: ["MONTHLY", "YEARLY"],
      purchase_types: ["NEW", "RENEWAL"],
    },
    fixed: {
      code: "FLAT50",
      type: "FIXED",
      discount_value: 50.0,
      min_purchase_amount: 100.0,
      max_uses: 50,
      is_active: true,
    },
    freeTrial: {
      code: "TRIAL30",
      type: "FREE_TRIAL",
      discount_value: 30, // 30 days
      max_uses: 200,
      max_uses_per_user: 1,
      is_active: true,
      purchase_types: ["NEW"],
    },
    seasonal: {
      code: "SUMMER2024",
      type: "PERCENTAGE",
      discount_value: 40.0,
      valid_from: "2024-06-01T00:00:00.000Z",
      valid_until: "2024-08-31T23:59:59.000Z",
      max_uses: 500,
      is_active: true,
    },
  },

  // SUBSCRIPTION PRICES
  pricing: {
    goldMonthly: {
      tier: "GOLD",
      billing_cycle: "MONTHLY",
      price: 29.99,
      currency: "USD",
      active: true,
    },
    goldYearly: {
      tier: "GOLD",
      billing_cycle: "YEARLY",
      price: 299.99,
      currency: "USD",
      active: true,
      discount_pct: 17, // 2 months free
    },
    platinumMonthly: {
      tier: "PLATINUM",
      billing_cycle: "MONTHLY",
      price: 79.99,
      currency: "USD",
      active: true,
    },
    platinumYearly: {
      tier: "PLATINUM",
      billing_cycle: "YEARLY",
      price: 799.99,
      currency: "USD",
      active: true,
      discount_pct: 17,
    },
    diamondMonthly: {
      tier: "DIAMOND",
      billing_cycle: "MONTHLY",
      price: 199.99,
      currency: "USD",
      active: true,
    },
    diamondYearly: {
      tier: "DIAMOND",
      billing_cycle: "YEARLY",
      price: 1999.99,
      currency: "USD",
      active: true,
      discount_pct: 17,
    },
    regionalPricing: {
      tier: "GOLD",
      billing_cycle: "MONTHLY",
      price: 24.99,
      currency: "EUR",
      region: "EU",
      active: true,
    },
  },

  // FEATURES
  features: {
    apiCalls: {
      name: "api_calls",
      description: "API calls per month",
    },
    storage: {
      name: "storage_gb",
      description: "Cloud storage in GB",
    },
    users: {
      name: "team_members",
      description: "Number of team members",
    },
    prioritySupport: {
      name: "priority_support",
      description: "24/7 priority customer support",
    },
    customBranding: {
      name: "custom_branding",
      description: "Custom branding and white labeling",
    },
    advancedAnalytics: {
      name: "advanced_analytics",
      description: "Advanced analytics and reporting",
    },
    apiWebhooks: {
      name: "api_webhooks",
      description: "Custom API webhooks",
    },
    sla: {
      name: "sla_guarantee",
      description: "99.9% uptime SLA guarantee",
    },
  },

  // FEATURE ASSIGNMENTS
  featureAssignments: {
    // GOLD TIER
    goldApiCalls: {
      tier: "GOLD",
      enabled: true,
      limit: 10000,
    },
    goldStorage: {
      tier: "GOLD",
      enabled: true,
      limit: 10, // 10 GB
    },
    goldUsers: {
      tier: "GOLD",
      enabled: true,
      limit: 5,
    },

    // PLATINUM TIER
    platinumApiCalls: {
      tier: "PLATINUM",
      enabled: true,
      limit: 50000,
    },
    platinumStorage: {
      tier: "PLATINUM",
      enabled: true,
      limit: 100, // 100 GB
    },
    platinumUsers: {
      tier: "PLATINUM",
      enabled: true,
      limit: 20,
    },
    platinumPrioritySupport: {
      tier: "PLATINUM",
      enabled: true,
      limit: null, // unlimited
    },
    platinumAnalytics: {
      tier: "PLATINUM",
      enabled: true,
      limit: null,
    },

    // DIAMOND TIER
    diamondApiCalls: {
      tier: "DIAMOND",
      enabled: true,
      limit: null, // unlimited
    },
    diamondStorage: {
      tier: "DIAMOND",
      enabled: true,
      limit: 1000, // 1 TB
    },
    diamondUsers: {
      tier: "DIAMOND",
      enabled: true,
      limit: null, // unlimited
    },
    diamondPrioritySupport: {
      tier: "DIAMOND",
      enabled: true,
      limit: null,
    },
    diamondBranding: {
      tier: "DIAMOND",
      enabled: true,
      limit: null,
    },
    diamondAnalytics: {
      tier: "DIAMOND",
      enabled: true,
      limit: null,
    },
    diamondWebhooks: {
      tier: "DIAMOND",
      enabled: true,
      limit: 50,
    },
    diamondSLA: {
      tier: "DIAMOND",
      enabled: true,
      limit: null,
    },
  },

  // SUBSCRIPTION UPDATES
  subscriptionActions: {
    activate: {
      notes: "Manually activated - verified payment via bank transfer",
    },
    cancel: {
      notes: "Cancelled at customer request - dissatisfied with features",
    },
    cancelFraud: {
      notes: "Cancelled due to suspicious activity and fraud detection",
    },
  },

  // REFUND ACTIONS
  refundActions: {
    approve: {
      notes:
        "Refund approved - customer unable to use service due to technical issues",
    },
    approvePolicy: {
      notes: "Refund approved - within 30-day money-back guarantee period",
    },
    reject: {
      notes: "Refund rejected - customer has been using service for 8 months",
    },
    rejectPolicy: {
      notes: "Refund rejected - outside the 30-day refund policy window",
    },
  },
};

// CURL COMMANDS FOR TESTING

export const curlCommands = `
# ========================================
# ADMIN LOGIN
# ========================================
curl -X POST http://localhost:3000/api/admin/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "admin@example.com",
    "password": "your_password"
  }'

# Set token
export ADMIN_TOKEN="your_token_here"

# ========================================
# CREATE FEATURES
# ========================================

# API Calls Feature
curl -X POST http://localhost:3000/api/admin/features \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.features.apiCalls)}'

# Storage Feature
curl -X POST http://localhost:3000/api/admin/features \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.features.storage)}'

# Team Members Feature
curl -X POST http://localhost:3000/api/admin/features \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.features.users)}'

# Priority Support Feature
curl -X POST http://localhost:3000/api/admin/features \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.features.prioritySupport)}'

# ========================================
# ASSIGN FEATURES TO TIERS
# ========================================

# GOLD: 10,000 API calls
curl -X POST http://localhost:3000/api/admin/features/1/assign-tier \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.featureAssignments.goldApiCalls)}'

# PLATINUM: 50,000 API calls
curl -X POST http://localhost:3000/api/admin/features/1/assign-tier \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.featureAssignments.platinumApiCalls)}'

# DIAMOND: Unlimited API calls
curl -X POST http://localhost:3000/api/admin/features/1/assign-tier \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.featureAssignments.diamondApiCalls)}'

# ========================================
# CREATE PRICING
# ========================================

# Gold Monthly
curl -X POST http://localhost:3000/api/admin/pricing \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.pricing.goldMonthly)}'

# Gold Yearly (with discount)
curl -X POST http://localhost:3000/api/admin/pricing \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.pricing.goldYearly)}'

# Platinum Monthly
curl -X POST http://localhost:3000/api/admin/pricing \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.pricing.platinumMonthly)}'

# Diamond Monthly
curl -X POST http://localhost:3000/api/admin/pricing \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.pricing.diamondMonthly)}'

# ========================================
# CREATE COUPONS
# ========================================

# 20% Discount Coupon
curl -X POST http://localhost:3000/api/admin/coupons \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.coupons.percentage)}'

# Fixed $50 Discount
curl -X POST http://localhost:3000/api/admin/coupons \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.coupons.fixed)}'

# 30-Day Free Trial
curl -X POST http://localhost:3000/api/admin/coupons \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.coupons.freeTrial)}'

# Seasonal Sale
curl -X POST http://localhost:3000/api/admin/coupons \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.coupons.seasonal)}'

# ========================================
# MANAGE SUBSCRIPTIONS
# ========================================

# Manually activate subscription
curl -X PATCH http://localhost:3000/api/admin/subscriptions/1/activate \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.subscriptionActions.activate)}'

# Cancel subscription
curl -X PATCH http://localhost:3000/api/admin/subscriptions/1/cancel \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.subscriptionActions.cancel)}'

# ========================================
# HANDLE REFUNDS
# ========================================

# Approve refund
curl -X POST http://localhost:3000/api/admin/refunds/1/approve \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.refundActions.approve)}'

# Reject refund
curl -X POST http://localhost:3000/api/admin/refunds/2/reject \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(adminTestData.refundActions.reject)}'

# ========================================
# VIEW STATISTICS
# ========================================

# Subscription overview
curl http://localhost:3000/api/admin/subscriptions/stats/overview \\
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Coupon statistics
curl http://localhost:3000/api/admin/coupons/1/stats \\
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Feature matrix
curl http://localhost:3000/api/admin/features/matrix \\
  -H "Authorization: Bearer $ADMIN_TOKEN"
`;

// POSTMAN COLLECTION EXPORT
export const postmanCollection = {
  info: {
    name: "Admin Subscription Management",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    {
      key: "baseUrl",
      value: "http://localhost:3000",
    },
    {
      key: "adminToken",
      value: "your_token_here",
    },
  ],
  item: [
    {
      name: "Subscriptions",
      item: [
        {
          name: "Get All Subscriptions",
          request: {
            method: "GET",
            header: [
              {
                key: "Authorization",
                value: "Bearer {{adminToken}}",
              },
            ],
            url: "{{baseUrl}}/api/admin/subscriptions",
          },
        },
        {
          name: "Get Subscription Stats",
          request: {
            method: "GET",
            header: [
              {
                key: "Authorization",
                value: "Bearer {{adminToken}}",
              },
            ],
            url: "{{baseUrl}}/api/admin/subscriptions/stats/overview",
          },
        },
        {
          name: "Activate Subscription",
          request: {
            method: "PATCH",
            header: [
              {
                key: "Authorization",
                value: "Bearer {{adminToken}}",
              },
              {
                key: "Content-Type",
                value: "application/json",
              },
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify(adminTestData.subscriptionActions.activate),
            },
            url: "{{baseUrl}}/api/admin/subscriptions/1/activate",
          },
        },
      ],
    },
    {
      name: "Coupons",
      item: [
        {
          name: "Get All Coupons",
          request: {
            method: "GET",
            header: [
              {
                key: "Authorization",
                value: "Bearer {{adminToken}}",
              },
            ],
            url: "{{baseUrl}}/api/admin/coupons",
          },
        },
        {
          name: "Create Coupon",
          request: {
            method: "POST",
            header: [
              {
                key: "Authorization",
                value: "Bearer {{adminToken}}",
              },
              {
                key: "Content-Type",
                value: "application/json",
              },
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify(adminTestData.coupons.percentage),
            },
            url: "{{baseUrl}}/api/admin/coupons",
          },
        },
      ],
    },
  ],
};

console.log("Admin test data ready!");
console.log("\nSample curl commands:");
console.log(curlCommands);
