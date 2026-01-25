import { auth } from "../../../../config/auth.config.js";
import {
  requireAuth,
  requireRole,
  optionalAuth,
  combineMiddleware,
  requireActiveAccount,
} from "../../../middleware/betterAuth.js";
import {
  getUserById,
  updateUserProfile,
  getUserSessions,
  revokeSession,
  revokeAllOtherSessions,
  getLinkedAccounts,
  unlinkAccount,
  hasTwoFactorEnabled,
} from "../../../utilities/betterAuthHelpers.js";
import sendResponse from "../../../utilities/sendResponse.js";
import httpStatus from "../../../utilities/httpStatus.js";
import throwError from "../../../utilities/throwError.js";

/**
 * Better Auth Custom Endpoints
 * These extend the built-in Better Auth endpoints with custom functionality
 */
async function betterAuthController(fastify, options) {
  // ========================================================================
  // Profile Management
  // ========================================================================

  /**
   * Get current user profile
   */
  fastify.get(
    "/me",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const user = await getUserById(request.user.id);

      return sendResponse(reply, httpStatus.OK, "Profile retrieved", {
        user,
      });
    },
  );

  /**
   * Update current user profile
   */
  fastify.patch(
    "/me",
    {
      preHandler: [combineMiddleware(requireAuth, requireActiveAccount)],
    },
    async (request, reply) => {
      const { firstName, lastName, phoneNumber, avatar, name } = request.body;

      const updatedUser = await updateUserProfile(request.user.id, {
        firstName,
        lastName,
        phoneNumber,
        avatar,
        name,
      });

      return sendResponse(reply, httpStatus.OK, "Profile updated", {
        user: updatedUser,
      });
    },
  );

  // ========================================================================
  // Session Management
  // ========================================================================

  /**
   * Get all active sessions
   */
  fastify.get(
    "/sessions",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const sessions = await getUserSessions(request.user.id);

      return sendResponse(reply, httpStatus.OK, "Sessions retrieved", {
        sessions,
        currentSessionId: request.session?.id,
      });
    },
  );

  /**
   * Revoke a specific session
   */
  fastify.delete(
    "/sessions/:sessionId",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { sessionId } = request.params;

      // Don't allow revoking current session via this endpoint
      if (sessionId === request.session?.id) {
        throw throwError(
          httpStatus.BAD_REQUEST,
          "Use logout endpoint to revoke current session",
        );
      }

      await revokeSession(sessionId);

      return sendResponse(reply, httpStatus.OK, "Session revoked");
    },
  );

  /**
   * Revoke all other sessions (keep current)
   */
  fastify.post(
    "/sessions/revoke-all",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const result = await revokeAllOtherSessions(
        request.user.id,
        request.session?.id,
      );

      return sendResponse(reply, httpStatus.OK, "All other sessions revoked", {
        revokedCount: result.count,
      });
    },
  );

  // ========================================================================
  // Account Linking
  // ========================================================================

  /**
   * Get linked accounts
   */
  fastify.get(
    "/linked-accounts",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const accounts = await getLinkedAccounts(request.user.id);

      return sendResponse(reply, httpStatus.OK, "Linked accounts retrieved", {
        accounts,
      });
    },
  );

  /**
   * Unlink an OAuth account
   */
  fastify.delete(
    "/linked-accounts/:accountId",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { accountId } = request.params;

      try {
        await unlinkAccount(request.user.id, accountId);

        return sendResponse(reply, httpStatus.OK, "Account unlinked");
      } catch (error) {
        throw throwError(httpStatus.BAD_REQUEST, error.message);
      }
    },
  );

  // ========================================================================
  // Two-Factor Authentication Status
  // ========================================================================

  /**
   * Check 2FA status
   */
  fastify.get(
    "/2fa/status",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const enabled = await hasTwoFactorEnabled(request.user.id);

      return sendResponse(reply, httpStatus.OK, "2FA status retrieved", {
        twoFactorEnabled: enabled,
      });
    },
  );

  // ========================================================================
  // Admin Endpoints
  // ========================================================================

  /**
   * Get user by ID (admin only)
   */
  fastify.get(
    "/admin/users/:userId",
    {
      preHandler: [requireRole("admin", "super_admin")],
    },
    async (request, reply) => {
      const { userId } = request.params;
      const user = await getUserById(userId);

      if (!user) {
        throw throwError(httpStatus.NOT_FOUND, "User not found");
      }

      return sendResponse(reply, httpStatus.OK, "User retrieved", { user });
    },
  );

  /**
   * Deactivate user (admin only)
   */
  fastify.post(
    "/admin/users/:userId/deactivate",
    {
      preHandler: [requireRole("admin", "super_admin")],
    },
    async (request, reply) => {
      const { userId } = request.params;

      const { deactivateUser } =
        await import("../../../utilities/betterAuthHelpers.js");
      const user = await deactivateUser(userId);

      return sendResponse(reply, httpStatus.OK, "User deactivated", { user });
    },
  );

  /**
   * Activate user (admin only)
   */
  fastify.post(
    "/admin/users/:userId/activate",
    {
      preHandler: [requireRole("admin", "super_admin")],
    },
    async (request, reply) => {
      const { userId } = request.params;

      const { activateUser } =
        await import("../../../utilities/betterAuthHelpers.js");
      const user = await activateUser(userId);

      return sendResponse(reply, httpStatus.OK, "User activated", { user });
    },
  );

  // ========================================================================
  // Custom Authentication Logic Examples
  // ========================================================================

  /**
   * Custom endpoint - check authentication status
   */
  fastify.get(
    "/check",
    {
      preHandler: [optionalAuth],
    },
    async (request, reply) => {
      return sendResponse(reply, httpStatus.OK, "Authentication status", {
        authenticated: !!request.user,
        user: request.user || null,
      });
    },
  );

  /**
   * Custom webhook endpoint for post-signup processing
   */
  fastify.post("/webhook/user-created", async (request, reply) => {
    // Verify webhook signature here in production
    const { userId, email } = request.body;

    // Custom logic after user creation
    // - Send welcome email
    // - Create default settings
    // - Trigger analytics
    // - etc.

    console.log(`New user created: ${email}`);

    return sendResponse(reply, httpStatus.OK, "Webhook processed");
  });
}

export default betterAuthController;
