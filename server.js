import buildApp from "./app/app.js";
import serverConfig from "./config/server.config.js";
import runJobs from "./app/jobs/index.js";
import { postHogClient } from "./app/lib/trackHog.js";
import { runWorkers, shutdownWorkers } from "./app/workers/index.js";
import { waitForRedis, redisClient } from "./config/redis.config.js";
import { closeAllQueues } from "./app/queues/queue.js";
import { prisma } from "./app/lib/prisma.js";

const TIMEOUTS = {
  DATABASE: 5000,
  REDIS: 5000,
  BACKGROUND_SERVICES: 10000,
  SERVER_CLOSE: 3000,
  REDIS_QUIT: 2000,
  POSTHOG_SHUTDOWN: 2000,
  CLEANUP_TOTAL: 10000,
  GRACEFUL_SHUTDOWN: 15000,
};

const { PORT, IS_PRODUCTION, DEVELOPMENT_PRODUCTION_UNSAFE_AUTH } =
  serverConfig;

/**
 * Race a promise against a timeout
 */
function withTimeout(promise, timeoutMs, operationName) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Execute async operation with error handling
 */
async function safeAsync(fn, operationName, fallbackValue = null) {
  try {
    return await fn();
  } catch (error) {
    console.error(`❌ ${operationName} failed:`, error.message);
    return fallbackValue;
  }
}

/**
 * Logger utilities - wrapping Pino logger with emojis for console output
 */
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  warn: (msg) => console.warn(`⚠️  ${msg}`),
  fatal: (msg) => console.error(`💥 ${msg}`),
  start: (msg) => console.log(`🚀 ${msg}`),
  stop: (msg) => console.log(`🛑 ${msg}`),
  clean: (msg) => console.log(`🧹 ${msg}`),
};

/**
 * Verify database connectivity
 */
async function checkDatabase() {
  try {
    await withTimeout(
      prisma.$queryRaw`SELECT 1`,
      TIMEOUTS.DATABASE,
      "Database connection"
    );
    log.success("Database connection established");
    return true;
  } catch (error) {
    log.error(`Database connection failed: ${error.message}`);
    throw error;
  }
}

/**
 * Verify Redis connectivity
 */
async function checkRedis() {
  try {
    await withTimeout(waitForRedis(), TIMEOUTS.REDIS, "Redis connection");
    log.success("Redis connection established");
    return true;
  } catch (error) {
    log.error(`Redis connection failed: ${error.message}`);
    log.warn(
      "Server will continue without Redis - some features may be limited"
    );
    return false;
  }
}

/**
 * Start background services (jobs and workers)
 */
async function startBackgroundServices() {
  try {
    await withTimeout(
      Promise.all([runJobs(), runWorkers()]),
      TIMEOUTS.BACKGROUND_SERVICES,
      "Background services startup"
    );
    log.success("Jobs and workers started successfully");
    return true;
  } catch (error) {
    log.error(`Background services startup failed: ${error.message}`);
    // Non-critical, allow server to continue
    return false;
  }
}

/**
 * Check all critical dependencies before starting
 */
async function checkDependencies() {
  await checkDatabase(); // Critical - will throw if fails
  await checkRedis(); // Optional - logs warning if fails
}

async function closeFastify(app) {
  if (!app) return;

  return safeAsync(
    () => withTimeout(app.close(), TIMEOUTS.SERVER_CLOSE, "Fastify close"),
    "Fastify server close"
  );
}

async function closeWorkers() {
  return safeAsync(
    () =>
      withTimeout(shutdownWorkers(), TIMEOUTS.SERVER_CLOSE, "Workers shutdown"),
    "Workers shutdown"
  );
}

async function closeQueues() {
  return safeAsync(
    () => withTimeout(closeAllQueues(), TIMEOUTS.SERVER_CLOSE, "Queues close"),
    "Queues close"
  );
}

async function closeRedis() {
  if (!redisClient || !redisClient?.isOpen) return;

  return safeAsync(async () => {
    try {
      await withTimeout(redisClient.quit(), TIMEOUTS.REDIS_QUIT, "Redis quit");
    } catch {
      await redisClient.disconnect().then(() => {});
    }
  }, "Redis close");
}

async function closeDatabase() {
  return safeAsync(
    () =>
      withTimeout(
        prisma.$disconnect(),
        TIMEOUTS.SERVER_CLOSE,
        "Database disconnect"
      ),
    "Database disconnect"
  );
}

async function closePostHog() {
  if (!serverConfig.POST_HOG_API_KEY) return;

  return safeAsync(
    () =>
      withTimeout(
        postHogClient.shutdown(),
        TIMEOUTS.POSTHOG_SHUTDOWN,
        "PostHog shutdown"
      ),
    "PostHog shutdown"
  );
}

/**
 * Execute all cleanup tasks in parallel
 */
async function performCleanup(app = null) {
  log.clean("Starting cleanup...");

  const tasks = [
    closeFastify(app),
    closeWorkers(),
    closeQueues(),
    closeRedis(),
    closeDatabase(),
    closePostHog(),
  ];

  try {
    await withTimeout(
      Promise.allSettled(tasks),
      TIMEOUTS.CLEANUP_TOTAL,
      "Complete cleanup"
    );
    log.success("Cleanup completed");
  } catch (error) {
    log.warn("Cleanup timeout, forcing exit");
  }
}

// Shutdown state
let isShuttingDown = false;
let shutdownTimeout = null;

/**
 * Handle graceful shutdown
 */
async function handleShutdown(signal, app) {
  if (isShuttingDown) {
    log.warn(`Already shutting down, ignoring signal: ${signal}`);
    return;
  }

  isShuttingDown = true;
  log.stop(`${signal} signal received: starting graceful shutdown...`);

  shutdownTimeout = setTimeout(() => {
    log.fatal("Graceful shutdown timeout (15s), forcing exit");
    process.exit(1);
  }, TIMEOUTS.GRACEFUL_SHUTDOWN);

  try {
    await performCleanup(app);
    clearTimeout(shutdownTimeout);
    log.success("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    log.fatal(`Error during shutdown: ${error.message}`);
    process.exit(1);
  }
}

function handleUncaughtException(error, app) {
  log.fatal(`Uncaught exception: ${error.message}`);
  console.error(error.stack);

  if (IS_PRODUCTION) {
    handleShutdown("UNCAUGHT_EXCEPTION", app);
  } else {
    log.warn("Development mode: continuing despite uncaught exception");
  }
}

function handleUnhandledRejection(reason, promise, app) {
  log.fatal("Unhandled rejection at:");
  console.error(promise);
  log.fatal(`Reason: ${reason}`);

  if (IS_PRODUCTION) {
    handleShutdown("UNHANDLED_REJECTION", app);
  } else {
    log.warn("Development mode: continuing despite unhandled rejection");
  }
}

function handleWarning(warning) {
  log.warn(`${warning.name}: ${warning.message}`);
}

/**
 * Register all shutdown handlers
 */
function setupGracefulShutdown(app) {
  process.on("SIGTERM", () => handleShutdown("SIGTERM", app));
  process.on("SIGINT", () => handleShutdown("SIGINT", app));
  process.on("uncaughtException", (error) =>
    handleUncaughtException(error, app)
  );
  process.on("unhandledRejection", (reason, promise) =>
    handleUnhandledRejection(reason, promise, app)
  );
  process.on("warning", (warning) => handleWarning(warning));
}

/**
 * Log server startup information
 */
function logServerInfo() {
  const mode = IS_PRODUCTION ? "Production" : "Development";
  const authWarning = DEVELOPMENT_PRODUCTION_UNSAFE_AUTH
    ? " - UNSAFE AUTH"
    : "";
  const baseUrl = serverConfig.BASE_URL || `http://localhost:${PORT}`;

  console.log("\n");
  log.start("Server started successfully!");
  console.log(`📍 URL: ${baseUrl}\n`);

  console.log("⚙️  Configuration:");
  console.log(`  ├─ Environment: ${mode}${authWarning}`);
  console.log(
    `  └─ PostHog: ${
      serverConfig.POST_HOG_API_KEY ? "✅ Enabled" : "⚠️  Not configured"
    }\n`
  );
}

/**
 * Start the server with all initialization steps
 */
async function startServer() {
  let app = null;

  try {
    log.start("Starting server...");

    // Step 1: Check critical dependencies
    await checkDependencies();

    // Step 2: Start background services (non-blocking)
    await startBackgroundServices();

    // Step 3: Build and start Fastify server
    app = await buildApp();
    await app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
      logServerInfo();
    });

    // Step 4: Setup graceful shutdown handlers
    setupGracefulShutdown(app);

    return app;
  } catch (error) {
    log.fatal(`Server startup failed: ${error.message}`);
    console.error(error.stack);

    await performCleanup(app);
    process.exit(1);
  }
}

startServer().catch((error) => {
  log.fatal(`Fatal startup error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
