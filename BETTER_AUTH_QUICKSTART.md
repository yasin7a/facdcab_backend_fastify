# 🚀 Better Auth Quick Start

## Installation

```bash
npm install better-auth @better-auth/prisma
```

## Setup Steps

### 1. Database Migration

```bash
npm run p:migrate
```

This creates all Better Auth tables (users, accounts, sessions, verifications, two_factors).

### 2. Environment Variables

Make sure these are set in your `.env`:

```env
BASE_URL=http://localhost:9095
CLIENT_URL=http://localhost:3000
ACCESS_TOKEN_SECRET=your-super-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. Start the Server

```bash
npm run dev
```

## Quick Test

### Sign Up

```bash
curl -X POST http://localhost:9095/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Sign In

```bash
curl -X POST http://localhost:9095/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }' \
  -c cookies.txt
```

### Get Session

```bash
curl http://localhost:9095/api/auth/session \
  -b cookies.txt
```

### Get Profile

```bash
curl http://localhost:9095/api/user/me \
  -b cookies.txt
```

## Available Endpoints

### Built-in (Better Auth)

- `POST /api/auth/sign-up` - Register
- `POST /api/auth/sign-in` - Login
- `POST /api/auth/sign-out` - Logout
- `GET /api/auth/session` - Get session
- `POST /api/auth/forgot-password` - Request reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/sign-in/google` - Google OAuth
- `POST /api/auth/two-factor/enable` - Enable 2FA
- `POST /api/auth/two-factor/verify` - Verify 2FA

### Custom Endpoints

- `GET /api/user/me` - Get profile (protected)
- `PATCH /api/user/me` - Update profile (protected)
- `GET /api/user/sessions` - List sessions (protected)
- `DELETE /api/user/sessions/:id` - Revoke session (protected)
- `POST /api/user/sessions/revoke-all` - Revoke all sessions (protected)
- `GET /api/user/linked-accounts` - List OAuth accounts (protected)
- `GET /api/user/2fa/status` - Check 2FA status (protected)

## Frontend Example (React/Next.js)

```javascript
// Sign up
async function signUp(data) {
  const res = await fetch("/api/auth/sign-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include", // Important!
  });
  return res.json();
}

// Sign in
async function signIn(email, password) {
  const res = await fetch("/api/auth/sign-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  return res.json();
}

// Get current user
async function getCurrentUser() {
  const res = await fetch("/api/auth/session", {
    credentials: "include",
  });
  return res.json();
}

// Sign out
async function signOut() {
  const res = await fetch("/api/auth/sign-out", {
    method: "POST",
    credentials: "include",
  });
  return res.json();
}
```

## Customization

All customization is in `config/auth.config.js`:

### Add Custom Fields

```javascript
user: {
  additionalFields: {
    customField: {
      type: "string",
      required: false,
      input: true,
    }
  }
}
```

### Add Hooks

```javascript
hooks: {
  after: {
    signUp: async (user) => {
      // Your custom logic
      await sendWelcomeEmail(user);
      return { user };
    };
  }
}
```

### Add OAuth Providers

```javascript
socialProviders: {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    enabled: true,
  }
}
```

## Protecting Routes

```javascript
import { requireAuth, requireRole } from "./app/middleware/betterAuth.js";

// Require authentication
fastify.get(
  "/protected",
  {
    preHandler: [requireAuth],
  },
  handler,
);

// Require role
fastify.get(
  "/admin",
  {
    preHandler: [requireRole("admin")],
  },
  handler,
);
```

## Documentation

- Full Guide: [BETTER_AUTH_GUIDE.md](./BETTER_AUTH_GUIDE.md)
- Examples: [CUSTOMIZATION_EXAMPLES.md](./CUSTOMIZATION_EXAMPLES.md)
- Better Auth Docs: https://better-auth.com

## Need Help?

Check the comprehensive guides or review the example implementations in the codebase.
