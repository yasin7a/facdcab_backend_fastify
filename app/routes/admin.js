import createPermissionChecker from "../middleware/checkPermission.js";
import { createRouteLimiter } from "../middleware/rateLimit.js";
import setupRouteRegistry from "../middleware/routeRegistry.js";
import turnstileWidget from "../middleware/turnstileWidget.js";
import verifyAuth from "../middleware/verifyAuth.js";
import verifyUserAccount from "../middleware/verifyUserAccount.js";
import adminApplicationManageController from "../modules/admin/application/application.controller.js";
import authAdminUserController, {
  alphaAdminController,
} from "../modules/admin/auth/auth.controller.js";
import adminDashboardController from "../modules/admin/dashboard/dashboard.controller.js";
import adminDocumentCategoryController from "../modules/admin/document-category/documentCategory.controller.js";
import adminDocumentTypeController from "../modules/admin/document-type/documentType.controller.js";
import adminManageOfficeHoursController from "../modules/admin/office-hour/office-hour.controller.js";
import adminUserProfileController from "../modules/admin/profile/profile.controller.js";
import adminRolePermissionController from "../modules/admin/role-permission/role.controller.js";
import adminStaffController from "../modules/admin/staff/staff.controller.js";
import adminUserController from "../modules/admin/user/user.controller.js";
import adminDeskManagerController from "../modules/desk-manager/deskManager.controller.js";
import adminDeskController from "../modules/desk/desk.controller.js";
import { UserType } from "../utilities/constant.js";
const protectedRoutes = [
  { controller: adminDashboardController, prefix: "/dashboard" },
  { controller: adminRolePermissionController, prefix: "/role-permission" },
  { controller: adminStaffController, prefix: "/staff" },
  { controller: adminDocumentCategoryController, prefix: "/document-category" },
  { controller: adminDocumentTypeController, prefix: "/document-type" },
  { controller: adminApplicationManageController, prefix: "/application" },
  { controller: adminUserController, prefix: "/user" },
  { controller: adminManageOfficeHoursController, prefix: "/office-hour" },
  { controller: adminDeskController, prefix: "/desk" },
  { controller: adminDeskManagerController, prefix: "/desk-manager" },
  {
    controller: adminUserProfileController,
    prefix: "/profile",
    skipPermission: true,
  },
];
async function adminRoutes(fastify, options) {
  fastify.register(alphaAdminController);

  fastify.register(
    async (fastify) => {
      await createRouteLimiter(fastify, 20, 5);
      fastify.addHook("preHandler", turnstileWidget);
      fastify.register(authAdminUserController);
    },
    { prefix: "/auth" }
  );

  fastify.register(async (fastify) => {
    fastify.addHook("preHandler", verifyAuth);
    fastify.addHook(
      "preHandler",
      verifyUserAccount({
        model: "adminUser",
        type: [UserType.ADMIN, UserType.STAFF],
      })
    );

    // setupRouteRegistry(fastify, protectedRoutes);
    // fastify.addHook("preHandler", createPermissionChecker());

    protectedRoutes.forEach(({ controller, prefix }) => {
      fastify.register(controller, { prefix });
    });
  });
}

export default adminRoutes;
