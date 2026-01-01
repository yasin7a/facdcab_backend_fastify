import fastifyCookie from "@fastify/cookie";
import fastifyEtag from "@fastify/etag";
import fastifyFormbody from "@fastify/formbody";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fastify from "fastify";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import serverConfig from "../config/server.config.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import rateLimiter from "./middleware/rateLimit.js";
import securityMiddleware from "./middleware/security.js";
import routes from "./routes/index.js";
import registerPerformanceHooks from "./hooks/performance.hooks.js";
import generateRandomId from "./utilities/generateRandomId.js";
import googleOAuthPlugin from "./plugins/googleOAuth.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_CONFIG = {
  VERSION: "2.0.1",
  BODY_LIMIT: 500 * 1024 * 1024, // 500MB
  FILE_SIZE_LIMIT: 500 * 1024 * 1024, // 500MB
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get database name from connection URL
 */
function getDatabaseName() {
  const dbUrl = serverConfig.DATABASE_URL;

  if (dbUrl.includes("rds.amazonaws.com")) return "AWS-RDS";
  if (dbUrl.includes("render.com")) return "Render";
  return "Local";
}

/**
 * Get environment info for API response
 */
function getEnvironmentInfo() {
  const mode = serverConfig.IS_PRODUCTION ? "Production" : "Development";
  const authStatus = serverConfig.DEVELOPMENT_PRODUCTION_UNSAFE_AUTH
    ? "Unsafe Auth Enabled"
    : "Safe Auth Enabled";

  return `${mode} Mode (${authStatus})`;
}

/**
 * Ensure uploads directory exists
 */
function ensureUploadsDirectory() {
  const uploadsDir = path.join(process.cwd(), "uploads");

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  return uploadsDir;
}

// ============================================================================
// PLUGIN REGISTRATION
// ============================================================================

/**
 * Register Google OAuth plugin
 */
async function registerOAuth(app) {
  await googleOAuthPlugin(app);
}

/**
 * Register ETag plugin
 */
async function registerEtag(app) {
  await app.register(fastifyEtag);
}

/**
 * Register security plugins (CORS, Helmet, Compression)
 */
async function registerSecurity(app) {
  await securityMiddleware(app);
}

/**
 * Register cookie parser
 */
async function registerCookie(app) {
  await app.register(fastifyCookie);
}

/**
 * Register rate limiter
 */
async function registerRateLimiter(app) {
  await rateLimiter(app);
}

/**
 * Register form body parser
 */
async function registerFormBody(app) {
  await app.register(fastifyFormbody);
}

/**
 * Register multipart form data handler
 */
async function registerMultipart(app) {
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: APP_CONFIG.FILE_SIZE_LIMIT, // 500MB
    },
  });
}

/**
 * Register static file serving for uploads
 */
async function registerStaticFiles(app) {
  const uploadsDir = ensureUploadsDirectory();

  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: "/uploads/",
  });
}

/**
 * Register all application routes
 */
async function registerRoutes(app) {
  await app.register(routes, { prefix: "/api" });
}

/**
 * Register all plugins in order
 */
async function registerPlugins(app) {
  await registerEtag(app);
  await registerSecurity(app);
  await registerCookie(app);
  await registerRateLimiter(app);
  await registerOAuth(app);
  await registerFormBody(app);
  await registerMultipart(app);
  await registerStaticFiles(app);
  await registerRoutes(app);
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Setup request hooks
 */
function setupHooks(app) {
  // Register performance monitoring hooks
  registerPerformanceHooks(app);
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Register root health check route
 */
function registerRootRoute(app) {
  app.get("/", async (request, reply) => {
    return {
      message: "API server is running",
      status: "OK",
      version: APP_CONFIG.VERSION,
      process: getEnvironmentInfo(),
      db: getDatabaseName(),
    };
  });
  app.get("/favicon.ico", (request, reply) => {
    reply
      .code(204)
      .header("Content-Length", "0")
      .header("Cache-Control", "public, max-age=31536000")
      .send();
  });
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

/**
 * Setup error handlers
 */
function setupErrorHandlers(app) {
  app.setNotFoundHandler(notFoundHandler);
  // Error handler already set at app initialization
}

// ============================================================================
// APP BUILDER
// ============================================================================

/**
 * Build and configure Fastify application
 */
async function buildApp(opts = {}) {
  // Create Fastify instance
  const app = fastify({
    logger: !serverConfig.IS_PRODUCTION || false,
    trustProxy: true,
    bodyLimit: APP_CONFIG.BODY_LIMIT,
    requestIdHeader: "x-request-id",
    genReqId: (req) => req.headers["x-request-id"] || generateRandomId(),
    disableRequestLogging: serverConfig.IS_PRODUCTION ? true : false,
    ...opts,
  });

  // Set custom error serializer
  app.setErrorHandler((error, request, reply) => {
    return errorHandler(error, request, reply);
  });

  try {
    // Setup hooks
    setupHooks(app);

    // Register all plugins
    await registerPlugins(app);

    // Register root route
    registerRootRoute(app);

    // Setup error handlers (must be last)
    setupErrorHandlers(app);

    return app;
  } catch (error) {
    console.error("Failed to build app:", error);
    throw error;
  }
}

export default buildApp;
