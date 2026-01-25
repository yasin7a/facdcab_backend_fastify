import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../app/lib/prisma.js";
import serverConfig from "./server.config.js";

/**
 * Better Auth Configuration
 * Full flexibility with all customization options
 */
export const auth = betterAuth({
  // Database adapter using Prisma
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Custom password validation
    async sendVerificationEmail(user, url, token) {
      // TODO: Implement your custom email sending logic
      console.log(`Verification email for ${user.email}: ${url}`);
    },
    async sendResetPasswordEmail(user, url, token) {
      // TODO: Implement your custom password reset email
      console.log(`Password reset for ${user.email}: ${url}`);
    },
  },

  // Social OAuth providers
  socialProviders: {
    google: {
      clientId: serverConfig.GOOGLE_CLIENT_ID,
      clientSecret: serverConfig.GOOGLE_CLIENT_SECRET,
      enabled: true,
    },
    // Add more providers as needed
    // github: {
    //   clientId: process.env.GITHUB_CLIENT_ID,
    //   clientSecret: process.env.GITHUB_CLIENT_SECRET,
    //   enabled: true,
    // },
  },

  // Account linking - link multiple OAuth providers to one account
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"], // Auto-link these providers
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache for 5 minutes
    },
  },

  // Two-factor authentication
  twoFactor: {
    enabled: true,
    issuer: serverConfig.PROJECT_NAME || "FACDCAB",
  },

  // Rate limiting for auth endpoints
  rateLimit: {
    enabled: true,
    window: 60, // 60 seconds
    max: 10, // max 10 requests per window
    storage: "memory", // Use "redis" for production
  },

  // Advanced security options
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
      domain: serverConfig.COOKIE_DOMAIN || undefined,
    },
    useSecureCookies: true,
    cookieSameSite: "lax",
    generateId: () => {
      // Custom ID generation
      return crypto.randomUUID();
    },
  },

  // Custom user fields - extend the user model
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: false,
        input: true, // Can be set during registration
      },
      lastName: {
        type: "string",
        required: false,
        input: true,
      },
      phoneNumber: {
        type: "string",
        required: false,
        input: true,
      },
      avatar: {
        type: "string",
        required: false,
      },
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    },
    // Model hooks for custom logic
    modelName: "user", // Lowercase to match Prisma convention
  },

  // Custom hooks for extending behavior
  hooks: {
    after: {
      signIn: async (user, session) => {
        // Custom logic after sign in
        console.log(`User ${user.email} signed in`);

        // You can track login events, update last login time, etc.
        // await prisma.user.update({
        //   where: { id: user.id },
        //   data: { lastLoginAt: new Date() }
        // });

        return { user, session };
      },
      signUp: async (user) => {
        // Custom logic after sign up
        console.log(`New user registered: ${user.email}`);

        // You can trigger welcome emails, analytics, etc.
        return { user };
      },
    },
    before: {
      signIn: async (request) => {
        // Validation before sign in
        // You can check if user is banned, etc.
        return request;
      },
    },
  },

  // Base path for auth routes
  basePath: "/api/auth",
  baseURL: serverConfig.BASE_URL,

  // Trust proxy for getting real IP
  trustedOrigins: [serverConfig.CLIENT_URL, serverConfig.BASE_URL],

  // Secret for signing tokens
  secret: serverConfig.ACCESS_TOKEN_SECRET,
});

/**
 * Export types and utilities
 */
export const {
  api: authAPI,
  handler: authHandler,
  session: authSession,
} = auth;
