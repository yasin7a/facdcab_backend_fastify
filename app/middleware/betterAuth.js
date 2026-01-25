import { auth } from "../../config/auth.config.js";
import httpStatus from "../utilities/httpStatus.js";
import throwError from "../utilities/throwError.js";

/**
 * Better Auth Middleware
 * Verify and attach user session to request
 */
export async function requireAuth(request, reply) {
  try {
    // Get session from cookies or Authorization header
    const authHeader = request.headers.authorization;
    const cookies = request.headers.cookie;

    // Build headers for Better Auth
    const headers = new Headers();
    if (authHeader) headers.set("authorization", authHeader);
    if (cookies) headers.set("cookie", cookies);

    // Create a mock Request object for Better Auth
    const mockRequest = new Request(request.url, { headers });

    // Get session using Better Auth
    const session = await auth.api.getSession({
      headers: Object.fromEntries(headers),
    });

    if (!session || !session.user) {
      throw throwError(httpStatus.UNAUTHORIZED, "Authentication required");
    }

    // Attach user and session to request
    request.user = session.user;
    request.session = session.session;
    request.auth_id = session.user.id;
  } catch (error) {
    if (error.statusCode) throw error;
    throw throwError(httpStatus.UNAUTHORIZED, "Invalid or expired session");
  }
}

/**
 * Optional auth - attaches user if authenticated, but doesn't require it
 */
export async function optionalAuth(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    const cookies = request.headers.cookie;

    const headers = new Headers();
    if (authHeader) headers.set("authorization", authHeader);
    if (cookies) headers.set("cookie", cookies);

    const mockRequest = new Request(request.url, { headers });

    const session = await auth.api.getSession({
      headers: Object.fromEntries(headers),
    });

    if (session?.user) {
      request.user = session.user;
      request.session = session.session;
      request.auth_id = session.user.id;
    }
  } catch (error) {
    // Silently fail for optional auth
    request.user = null;
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...allowedRoles) {
  return async function (request, reply) {
    // First ensure user is authenticated
    await requireAuth(request, reply);

    const userRole = request.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      throw throwError(
        httpStatus.FORBIDDEN,
        "You don't have permission to access this resource",
      );
    }
  };
}

/**
 * Verified email middleware
 */
export async function requireVerifiedEmail(request, reply) {
  await requireAuth(request, reply);

  if (!request.user?.emailVerified) {
    throw throwError(httpStatus.FORBIDDEN, "Email verification required");
  }
}

/**
 * Active account middleware
 */
export async function requireActiveAccount(request, reply) {
  await requireAuth(request, reply);

  if (!request.user?.isActive) {
    throw throwError(httpStatus.FORBIDDEN, "Your account has been deactivated");
  }
}

/**
 * Combine multiple middleware checks
 */
export function combineMiddleware(...middlewares) {
  return async function (request, reply) {
    for (const middleware of middlewares) {
      await middleware(request, reply);
    }
  };
}

export default requireAuth;
