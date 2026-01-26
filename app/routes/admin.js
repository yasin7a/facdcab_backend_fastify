import createPermissionChecker from "../middleware/checkPermission.js";
import { createRouteLimiter } from "../middleware/rateLimit.js";
import setupRouteRegistry from "../middleware/routeRegistry.js";
import turnstileWidget from "../middleware/turnstileWidget.js";
import verifyAuth from "../middleware/verifyAuth.js";
import verifyUserAccount from "../middleware/verifyUserAccount.js";
import authAdminUserController, {
  alphaAdminController,
} from "../modules/admin/auth/auth.controller.js";

import adminUserProfileController from "../modules/admin/profile/profile.controller.js";
import adminRolePermissionController from "../modules/admin/role-permission/role.controller.js";
import adminStaffController from "../modules/admin/staff/staff.controller.js";
import adminUserController from "../modules/admin/user/user.controller.js";

// Subscription & Payment Management
import adminSubscriptionManagementController from "../modules/admin/subscription-management/subscription.controller.js";
import adminSubscriptionCouponController from "../modules/admin/subscription-management/coupon.controller.js";
import adminSubscriptionPricingController from "../modules/admin/subscription-management/pricing.controller.js";
import adminSubscriptionFeatureController from "../modules/admin/subscription-management/feature.controller.js";
import adminSubscriptionRefundController from "../modules/admin/subscription-management/refund.controller.js";
import adminInvoiceController from "../modules/admin/subscription-management/invoice.controller.js";
import adminPaymentController from "../modules/admin/subscription-management/payment.controller.js";

// Event Management
import adminEventController from "../modules/admin/event/event.controller.js";
import adminStallBookingController from "../modules/admin/event/stall-booking.controller.js";
import adminSponsorshipController from "../modules/admin/event/sponsorship.controller.js";

import { UserType } from "../utilities/constant.js";

const protectedRoutes = [
  { controller: adminRolePermissionController, prefix: "/role-permission" },
  { controller: adminStaffController, prefix: "/staff" },
  { controller: adminUserController, prefix: "/user" },
  {
    controller: adminUserProfileController,
    prefix: "/profile",
    skipPermission: true,
  },
  // Subscription & Payment Management Routes
  {
    controller: adminSubscriptionManagementController,
    prefix: "/subscriptions",
  },
  {
    controller: adminSubscriptionPricingController,
    prefix: "/subscription-pricing",
  },
  {
    controller: adminSubscriptionFeatureController,
    prefix: "/subscription-features",
  },
  { controller: adminSubscriptionCouponController, prefix: "/coupons" },
  { controller: adminSubscriptionRefundController, prefix: "/refunds" },
  { controller: adminInvoiceController, prefix: "/invoices" },
  { controller: adminPaymentController, prefix: "/payments" },
  // Event Management Routes
  { controller: adminEventController, prefix: "/event" },
  { controller: adminStallBookingController, prefix: "/event-stall-booking" },
  { controller: adminSponsorshipController, prefix: "/event-sponsorship" },
];
async function adminRoutes(fastify, options) {
  fastify.register(alphaAdminController);

  fastify.register(
    async (fastify) => {
      await createRouteLimiter(fastify, 20, 5);
      fastify.addHook("preHandler", turnstileWidget);
      fastify.register(authAdminUserController);
    },
    { prefix: "/auth" },
  );

  fastify.register(async (fastify) => {
    fastify.addHook("preHandler", verifyAuth);
    fastify.addHook(
      "preHandler",
      verifyUserAccount({
        model: "adminUser",
        type: [UserType.ADMIN, UserType.STAFF],
      }),
    );

    // setupRouteRegistry(fastify, protectedRoutes);
    // fastify.addHook("preHandler", createPermissionChecker());

    protectedRoutes.forEach(({ controller, prefix }) => {
      fastify.register(controller, { prefix });
    });
  });
}

export default adminRoutes;
