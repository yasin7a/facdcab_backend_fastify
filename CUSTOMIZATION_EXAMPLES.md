/\*\*

- BETTER AUTH CUSTOMIZATION EXAMPLES
-
- This file contains practical examples of how to customize Better Auth
- for various use cases in your application.
  \*/

// ============================================================================
// 1. CUSTOM AUTHENTICATION FLOW
// ============================================================================

/\*\*

- Example: Add custom validation before sign-up
  \*/
  export const customSignUpValidation = {
  hooks: {
  before: {
  signUp: async (request) => {
  const { email } = request;

          // Check if email domain is allowed
          const allowedDomains = ["company.com", "trusted.com"];
          const emailDomain = email.split("@")[1];

          if (!allowedDomains.includes(emailDomain)) {
            throw new Error(
              `Sign-up is restricted to ${allowedDomains.join(", ")} domains`
            );
          }

          // Check if email is in blocklist
          const blockedEmails = await getBlockedEmails();
          if (blockedEmails.includes(email)) {
            throw new Error("This email is not allowed to register");
          }

          return request;
        },
      },

  },
  };

// ============================================================================
// 2. CUSTOM USER ROLES & PERMISSIONS
// ============================================================================

/\*\*

- Example: Complex role-based permissions system
  \*/

const ROLES = {
USER: "user",
MODERATOR: "moderator",
ADMIN: "admin",
SUPER_ADMIN: "super_admin",
};

const PERMISSIONS = {
// Content permissions
"content.create": [ROLES.USER, ROLES.MODERATOR, ROLES.ADMIN],
"content.edit.own": [ROLES.USER, ROLES.MODERATOR, ROLES.ADMIN],
"content.edit.any": [ROLES.MODERATOR, ROLES.ADMIN],
"content.delete.own": [ROLES.USER, ROLES.MODERATOR, ROLES.ADMIN],
"content.delete.any": [ROLES.MODERATOR, ROLES.ADMIN],

// User management
"users.view": [ROLES.ADMIN, ROLES.SUPER_ADMIN],
"users.edit": [ROLES.ADMIN, ROLES.SUPER_ADMIN],
"users.delete": [ROLES.SUPER_ADMIN],

// System settings
"settings.view": [ROLES.ADMIN, ROLES.SUPER_ADMIN],
"settings.edit": [ROLES.SUPER_ADMIN],
};

export function hasPermission(userRole, permission) {
const allowedRoles = PERMISSIONS[permission] || [];
return allowedRoles.includes(userRole);
}

export function requirePermission(permission) {
return async function (request, reply) {
await requireAuth(request, reply);

    if (!hasPermission(request.user.role, permission)) {
      throw throwError(
        httpStatus.FORBIDDEN,
        `Missing permission: ${permission}`
      );
    }

};
}

// ============================================================================
// 3. CUSTOM EMAIL TEMPLATES
// ============================================================================

/\*\*

- Example: Branded email templates with custom logic
  \*/

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
host: process.env.SMTP_HOST,
port: process.env.SMTP_PORT,
auth: {
user: process.env.SMTP_USER,
pass: process.env.SMTP_PASS,
},
});

export const customEmailTemplates = {
emailAndPassword: {
async sendVerificationEmail(user, url, token) {
const html = `         <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1>Welcome to ${process.env.PROJECT_NAME}!</h1>
              <p>Hi ${user.firstName || user.email},</p>
              <p>Thanks for signing up! Please verify your email address to get started.</p>
              <a href="${url}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Verify Email
              </a>
              <p style="margin-top: 20px; color: #666;">
                Or copy this link: ${url}
              </p>
              <p style="margin-top: 30px; color: #999; font-size: 12px;">
                If you didn't create this account, you can safely ignore this email.
              </p>
            </div>
          </body>
        </html>
      `;

      await transporter.sendMail({
        from: `"${process.env.PROJECT_NAME}" <noreply@yourapp.com>`,
        to: user.email,
        subject: "Verify your email address",
        html,
      });
    },

    async sendResetPasswordEmail(user, url, token) {
      const html = `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1>Reset Your Password</h1>
              <p>Hi ${user.firstName || user.email},</p>
              <p>We received a request to reset your password.</p>
              <a href="${url}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Reset Password
              </a>
              <p style="margin-top: 20px; color: #666;">
                This link will expire in 1 hour.
              </p>
              <p style="margin-top: 30px; color: #999; font-size: 12px;">
                If you didn't request this, please ignore this email and your password will remain unchanged.
              </p>
            </div>
          </body>
        </html>
      `;

      await transporter.sendMail({
        from: `"${process.env.PROJECT_NAME}" <noreply@yourapp.com>`,
        to: user.email,
        subject: "Reset your password",
        html,
      });
    },

},
};

// ============================================================================
// 4. CUSTOM POST-AUTHENTICATION ACTIONS
// ============================================================================

/\*\*

- Example: Comprehensive post-auth hooks
  \*/

export const postAuthActions = {
hooks: {
after: {
signUp: async (user) => {
// 1. Send welcome email
await sendWelcomeEmail(user);

        // 2. Create default user settings
        await prisma.userSettings.create({
          data: {
            userId: user.id,
            theme: "light",
            notifications: true,
            language: "en",
          },
        });

        // 3. Create default workspace
        await prisma.workspace.create({
          data: {
            name: `${user.firstName}'s Workspace`,
            ownerId: user.id,
          },
        });

        // 4. Track analytics
        await analytics.track("user_signed_up", {
          userId: user.id,
          email: user.email,
          provider: "email",
        });

        // 5. Add to CRM/mailing list
        await addToMailingList(user.email, user.firstName);

        return { user };
      },

      signIn: async (user, session) => {
        // 1. Update last login timestamp
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            lastLoginIp: session.ipAddress,
          },
        });

        // 2. Track login event
        await analytics.track("user_signed_in", {
          userId: user.id,
          provider: session.provider,
        });

        // 3. Check for account issues
        const hasPendingIssues = await checkAccountIssues(user.id);
        if (hasPendingIssues) {
          await notifyUserOfIssues(user);
        }

        return { user, session };
      },

      signOut: async (user, session) => {
        // Track logout
        await analytics.track("user_signed_out", {
          userId: user.id,
          sessionDuration: Date.now() - session.createdAt.getTime(),
        });

        return { user, session };
      },
    },

},
};

// ============================================================================
// 5. MULTI-TENANCY SUPPORT
// ============================================================================

/\*\*

- Example: Add organization/team support
  \*/

export async function createMultiTenantUser(userData, organizationId) {
const user = await prisma.user.create({
data: {
...userData,
organizationId,
},
});

// Add user to organization
await prisma.organizationMember.create({
data: {
userId: user.id,
organizationId,
role: "member",
},
});

return user;
}

export function requireOrganization(request, reply) {
return async function (request, reply) {
await requireAuth(request, reply);

    const organizationId = request.headers["x-organization-id"];
    if (!organizationId) {
      throw throwError(httpStatus.BAD_REQUEST, "Organization ID required");
    }

    // Check if user belongs to organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: request.user.id,
        organizationId,
      },
    });

    if (!membership) {
      throw throwError(
        httpStatus.FORBIDDEN,
        "You don't have access to this organization"
      );
    }

    request.organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    request.organizationRole = membership.role;

};
}

// ============================================================================
// 6. CUSTOM SESSION MANAGEMENT
// ============================================================================

/\*\*

- Example: Device-specific sessions with limits
  \*/

const MAX_SESSIONS_PER_USER = 5;

export async function createLimitedSession(userId, deviceInfo) {
// Get active sessions
const activeSessions = await prisma.session.count({
where: {
userId,
expiresAt: { gt: new Date() },
},
});

// If at limit, delete oldest session
if (activeSessions >= MAX_SESSIONS_PER_USER) {
const oldestSession = await prisma.session.findFirst({
where: {
userId,
expiresAt: { gt: new Date() },
},
orderBy: { createdAt: "asc" },
});

    if (oldestSession) {
      await prisma.session.delete({
        where: { id: oldestSession.id },
      });
    }

}

// Create new session with device info
return await prisma.session.create({
data: {
userId,
userAgent: deviceInfo.userAgent,
ipAddress: deviceInfo.ipAddress,
expiresAt: new Date(Date.now() + 7 _ 24 _ 60 _ 60 _ 1000), // 7 days
},
});
}

// ============================================================================
// 7. CUSTOM 2FA STRATEGIES
// ============================================================================

/\*\*

- Example: Multiple 2FA methods (TOTP + SMS + Email)
  \*/

export async function send2FACode(userId, method = "totp") {
const user = await getUserById(userId);

switch (method) {
case "sms":
const code = generateNumericCode(6);
await sendSMS(user.phoneNumber, `Your verification code: ${code}`);
await storeVerificationCode(userId, code, "sms");
break;

    case "email":
      const emailCode = generateNumericCode(6);
      await sendEmail(
        user.email,
        "Verification Code",
        `Your code: ${emailCode}`
      );
      await storeVerificationCode(userId, emailCode, "email");
      break;

    case "totp":
      // Use authenticator app (handled by Better Auth)
      break;

}
}

// ============================================================================
// 8. RATE LIMITING & SECURITY
// ============================================================================

/\*\*

- Example: Advanced rate limiting with IP tracking
  \*/

export async function checkLoginAttempts(email, ipAddress) {
const key = `login_attempts:${email}:${ipAddress}`;
const attempts = await redis.incr(key);

if (attempts === 1) {
await redis.expire(key, 900); // 15 minutes
}

if (attempts > 5) {
// Lock account temporarily
const lockKey = `account_locked:${email}`;
await redis.setex(lockKey, 3600, "1"); // 1 hour

    throw new Error(
      "Too many login attempts. Account locked for 1 hour."
    );

}

return attempts;
}

// ============================================================================
// 9. CUSTOM USER PROFILES & METADATA
// ============================================================================

/\*\*

- Example: Rich user profiles with custom fields
  \*/

export async function updateUserProfile(userId, profileData) {
return await prisma.user.update({
where: { id: userId },
data: {
firstName: profileData.firstName,
lastName: profileData.lastName,
phoneNumber: profileData.phoneNumber,
avatar: profileData.avatar,
bio: profileData.bio,
location: profileData.location,
website: profileData.website,
socialLinks: {
twitter: profileData.twitter,
linkedin: profileData.linkedin,
github: profileData.github,
},
preferences: {
theme: profileData.theme,
language: profileData.language,
timezone: profileData.timezone,
},
},
});
}

// ============================================================================
// 10. WEBHOOKS & INTEGRATIONS
// ============================================================================

/\*\*

- Example: Trigger webhooks on auth events
  \*/

export const webhookIntegration = {
hooks: {
after: {
signUp: async (user) => {
// Trigger external webhooks
const webhooks = await getActiveWebhooks("user.created");

        for (const webhook of webhooks) {
          await fetch(webhook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Webhook-Signature": signWebhook(
                webhook.secret,
                user
              ),
            },
            body: JSON.stringify({
              event: "user.created",
              data: user,
              timestamp: new Date().toISOString(),
            }),
          });
        }

        return { user };
      },
    },

},
};
