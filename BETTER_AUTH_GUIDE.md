# Better Auth Integration Guide

## Overview

This project uses **Better Auth** - a production-ready authentication library with full flexibility and customization options.

## Features Enabled

- ✅ Email/Password authentication with verification
- ✅ Google OAuth (easily add more providers)
- ✅ Account linking (link multiple OAuth providers)
- ✅ Two-Factor Authentication (TOTP)
- ✅ Session management
- ✅ Rate limiting
- ✅ CSRF protection
- ✅ Custom user fields
- ✅ Role-based access control
- ✅ Hooks for custom logic

## Installation

\`\`\`bash
npm install better-auth @better-auth/prisma
\`\`\`

## Database Setup

1. The Prisma schema is already configured in \`prisma/models/betterAuth.prisma\`
2. Run migrations:
   \`\`\`bash
   npm run p:migrate
   \`\`\`

## Configuration

### Auth Config (\`config/auth.config.js\`)

All auth settings are centralized here:

\`\`\`javascript
import { auth } from '../config/auth.config.js';

// Available configurations:

- Email & Password settings
- OAuth providers
- Session configuration
- Two-factor authentication
- Rate limiting
- Custom user fields
- Hooks (before/after auth events)
  \`\`\`

### Environment Variables

Required in \`.env\`:
\`\`\`env

# Base configuration

BASE_URL=https://your-domain.com
CLIENT_URL=http://localhost:3000

# JWT/Auth

ACCESS_TOKEN_SECRET=your-secret-key

# Google OAuth

GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Optional

COOKIE_DOMAIN=.company.com
\`\`\`

## Built-in Auth Endpoints

Better Auth automatically provides these endpoints at \`/api/auth/\*\`:

### Email/Password

- \`POST /api/auth/sign-up\` - Register with email/password
- \`POST /api/auth/sign-in\` - Login
- \`POST /api/auth/sign-out\` - Logout
- \`POST /api/auth/verify-email\` - Verify email
- \`POST /api/auth/forgot-password\` - Request password reset
- \`POST /api/auth/reset-password\` - Reset password

### OAuth

- \`GET /api/auth/sign-in/google\` - Initiate Google OAuth
- \`GET /api/auth/callback/google\` - Google OAuth callback

### Session

- \`GET /api/auth/session\` - Get current session
- \`POST /api/auth/session/refresh\` - Refresh session

### Two-Factor

- \`POST /api/auth/two-factor/enable\` - Enable 2FA
- \`POST /api/auth/two-factor/disable\` - Disable 2FA
- \`POST /api/auth/two-factor/verify\` - Verify 2FA code

### Account Linking

- \`POST /api/auth/link-account\` - Link OAuth account to existing user

## Custom Endpoints

Additional endpoints in \`app/modules/user/betterAuth/betterAuth.controller.js\`:

### Profile

- \`GET /api/user/me\` - Get current user profile
- \`PATCH /api/user/me\` - Update profile

### Session Management

- \`GET /api/user/sessions\` - List all active sessions
- \`DELETE /api/user/sessions/:id\` - Revoke specific session
- \`POST /api/user/sessions/revoke-all\` - Revoke all other sessions

### Account Linking

- \`GET /api/user/linked-accounts\` - List linked OAuth accounts
- \`DELETE /api/user/linked-accounts/:id\` - Unlink account

### Admin

- \`GET /api/user/admin/users/:id\` - Get user details (admin)
- \`POST /api/user/admin/users/:id/activate\` - Activate user (admin)
- \`POST /api/user/admin/users/:id/deactivate\` - Deactivate user (admin)

## Middleware Usage

### Protect Routes

\`\`\`javascript
import { requireAuth, requireRole } from './app/middleware/betterAuth.js';

// Require authentication
fastify.get('/protected', {
preHandler: [requireAuth]
}, async (request, reply) => {
// request.user contains authenticated user
// request.session contains session data
// request.auth_id contains user ID
});

// Require specific role
fastify.get('/admin', {
preHandler: [requireRole('admin', 'super_admin')]
}, async (request, reply) => {
// Only admin or super_admin can access
});

// Optional authentication
import { optionalAuth } from './app/middleware/betterAuth.js';

fastify.get('/public', {
preHandler: [optionalAuth]
}, async (request, reply) => {
// request.user will be set if authenticated, null otherwise
});

// Combine multiple checks
import { combineMiddleware, requireActiveAccount } from './app/middleware/betterAuth.js';

fastify.post('/sensitive', {
preHandler: [combineMiddleware(requireAuth, requireActiveAccount)]
}, async (request, reply) => {
// Requires auth AND active account
});
\`\`\`

## Helper Functions

All helper functions in \`app/utilities/betterAuthHelpers.js\`:

\`\`\`javascript
import {
getUserById,
updateUserProfile,
getUserSessions,
revokeSession,
getLinkedAccounts,
hasTwoFactorEnabled,
searchUsers,
cleanupExpiredData,
} from './app/utilities/betterAuthHelpers.js';

// Example usage
const user = await getUserById(userId);
const sessions = await getUserSessions(userId);
\`\`\`

## Customization Examples

### 1. Custom User Fields

Already configured in \`config/auth.config.js\`:

- firstName
- lastName
- phoneNumber
- avatar
- role
- isActive

Add more in the config:

\`\`\`javascript
user: {
additionalFields: {
company: {
type: "string",
required: false,
input: true,
},
preferences: {
type: "json",
required: false,
}
}
}
\`\`\`

### 2. Custom Hooks

\`\`\`javascript
hooks: {
after: {
signUp: async (user) => {
// Send welcome email
await sendWelcomeEmail(user.email);

      // Create default settings
      await createUserDefaults(user.id);

      return { user };
    },
    signIn: async (user, session) => {
      // Track login
      await analytics.track('user_login', { userId: user.id });

      return { user, session };
    }

},
before: {
signIn: async (request) => {
// Check if user is banned
const user = await getUserByEmail(request.email);
if (user?.isBanned) {
throw new Error('Account is banned');
}
return request;
}
}
}
\`\`\`

### 3. Custom Email Templates

Update in \`config/auth.config.js\`:

\`\`\`javascript
emailAndPassword: {
async sendVerificationEmail(user, url, token) {
await yourEmailService.send({
to: user.email,
subject: 'Verify your email',
template: 'verification',
data: { user, url, token }
});
}
}
\`\`\`

### 4. Add More OAuth Providers

\`\`\`javascript
socialProviders: {
google: { /_ existing _/ },
github: {
clientId: process.env.GITHUB_CLIENT_ID,
clientSecret: process.env.GITHUB_CLIENT_SECRET,
enabled: true,
},
facebook: {
clientId: process.env.FACEBOOK_CLIENT_ID,
clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
enabled: true,
}
}
\`\`\`

### 5. Custom Role System

Create middleware for granular permissions:

\`\`\`javascript
export function requirePermission(permission) {
return async function (request, reply) {
await requireAuth(request, reply);

    const userPermissions = await getPermissions(request.user.id);

    if (!userPermissions.includes(permission)) {
      throw throwError(httpStatus.FORBIDDEN, 'Insufficient permissions');
    }

};
}

// Usage
fastify.delete('/posts/:id', {
preHandler: [requirePermission('posts.delete')]
}, handler);
\`\`\`

## Frontend Integration

### Sign Up

\`\`\`javascript
const response = await fetch('/api/auth/sign-up', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
email: 'user@example.com',
password: 'securePassword123',
firstName: 'John',
lastName: 'Doe',
}),
credentials: 'include', // Important for cookies
});
\`\`\`

### Sign In

\`\`\`javascript
const response = await fetch('/api/auth/sign-in', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
email: 'user@example.com',
password: 'securePassword123',
}),
credentials: 'include',
});
\`\`\`

### Get Current User

\`\`\`javascript
const response = await fetch('/api/auth/session', {
credentials: 'include',
});
const { user, session } = await response.json();
\`\`\`

### OAuth Sign In

\`\`\`javascript
// Redirect to OAuth provider
window.location.href = '/api/auth/sign-in/google';
\`\`\`

## Production Checklist

- [ ] Set strong \`ACCESS_TOKEN_SECRET\`
- [ ] Configure \`BASE_URL\` and \`CLIENT_URL\`
- [ ] Set up proper email service
- [ ] Enable Redis for rate limiting
- [ ] Configure CORS for \`CLIENT_URL\`
- [ ] Set up SSL certificates
- [ ] Enable secure cookies (\`useSecureCookies: true\`)
- [ ] Set up monitoring/logging
- [ ] Configure backup codes for 2FA
- [ ] Test all OAuth flows
- [ ] Set up cron job for \`cleanupExpiredData()\`

## Testing

Test endpoints with curl:

\`\`\`bash

# Sign up

curl -X POST http://localhost:9095/api/auth/sign-up \\
-H "Content-Type: application/json" \\
-d '{"email":"test@example.com","password":"password123"}'

# Sign in

curl -X POST http://localhost:9095/api/auth/sign-in \\
-H "Content-Type: application/json" \\
-d '{"email":"test@example.com","password":"password123"}' \\
-c cookies.txt

# Get profile (using saved cookies)

curl http://localhost:9095/api/user/me \\
-b cookies.txt
\`\`\`

## Troubleshooting

### Session not persisting

- Ensure \`credentials: 'include'\` in frontend fetch
- Check CORS settings allow credentials
- Verify cookie settings (secure, sameSite)

### OAuth redirect not working

- Check \`BASE_URL\` is correct
- Verify OAuth app callback URL matches

### 2FA QR code not generating

- Install qrcode package: \`npm install qrcode\`
- Check \`otplib\` is installed

## Migration from Old Auth

If migrating from your old auth system:

1. Keep old auth endpoints during transition
2. Create migration script to convert users
3. Map old user fields to new schema
4. Run migration in stages
5. Deprecate old endpoints after full migration

## Support & Resources

- Better Auth Docs: https://better-auth.com
- Prisma Docs: https://prisma.io/docs
- File issues in your repo
