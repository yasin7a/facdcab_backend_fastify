import { auth } from "../../config/auth.config.js";
import { prisma } from "../lib/prisma.js";

/**
 * Better Auth Utility Functions
 * Helper functions for custom auth operations
 */

/**
 * Get user by ID with full details
 */
export async function getUserById(userId) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accounts: true,
      sessions: true,
      twoFactor: true,
    },
  });
}

/**
 * Get user by email
 */
export async function getUserByEmail(email) {
  return await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: true,
    },
  });
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId, data) {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      avatar: data.avatar,
      name: data.name,
      updatedAt: new Date(),
    },
  });
}

/**
 * Deactivate user account
 */
export async function deactivateUser(userId) {
  // Revoke all sessions
  await prisma.session.deleteMany({
    where: { userId },
  });

  // Deactivate account
  return await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });
}

/**
 * Activate user account
 */
export async function activateUser(userId) {
  return await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
  });
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId) {
  return await prisma.session.findMany({
    where: {
      userId,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId) {
  return await prisma.session.delete({
    where: { id: sessionId },
  });
}

/**
 * Revoke all sessions except current
 */
export async function revokeAllOtherSessions(userId, currentSessionId) {
  return await prisma.session.deleteMany({
    where: {
      userId,
      id: {
        not: currentSessionId,
      },
    },
  });
}

/**
 * Check if user has 2FA enabled
 */
export async function hasTwoFactorEnabled(userId) {
  const twoFactor = await prisma.twoFactor.findUnique({
    where: { userId },
  });

  return !!twoFactor;
}

/**
 * Get user's linked accounts
 */
export async function getLinkedAccounts(userId) {
  return await prisma.account.findMany({
    where: { userId },
    select: {
      id: true,
      providerId: true,
      accountId: true,
      createdAt: true,
    },
  });
}

/**
 * Unlink OAuth account
 */
export async function unlinkAccount(userId, accountId) {
  // Check if user has password or other accounts
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accounts: true,
    },
  });

  const hasPassword = user.accounts.some((acc) => acc.password);
  const accountCount = user.accounts.length;

  // Prevent removing last auth method
  if (!hasPassword && accountCount <= 1) {
    throw new Error(
      "Cannot remove last authentication method. Please set a password first.",
    );
  }

  return await prisma.account.delete({
    where: {
      id: accountId,
      userId, // Ensure user owns this account
    },
  });
}

/**
 * Search users (admin function)
 */
export async function searchUsers(query, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const where = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            sessions: true,
            accounts: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Update user role (admin function)
 */
export async function updateUserRole(userId, role) {
  return await prisma.user.update({
    where: { id: userId },
    data: { role },
  });
}

/**
 * Get authentication statistics
 */
export async function getAuthStats() {
  const [totalUsers, activeUsers, verifiedUsers, usersWithTwoFactor] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.twoFactor.count(),
    ]);

  const activeSessions = await prisma.session.count({
    where: {
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  return {
    totalUsers,
    activeUsers,
    verifiedUsers,
    usersWithTwoFactor,
    activeSessions,
  };
}

/**
 * Clean up expired sessions and verifications (run in cron job)
 */
export async function cleanupExpiredData() {
  const now = new Date();

  const [deletedSessions, deletedVerifications] = await Promise.all([
    prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    }),
    prisma.verification.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    }),
  ]);

  return {
    deletedSessions: deletedSessions.count,
    deletedVerifications: deletedVerifications.count,
  };
}
