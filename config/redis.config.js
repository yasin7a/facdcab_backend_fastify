import Redis from "ioredis";
import serverConfig from "./server.config.js";

const redisConnection = serverConfig.REDIS_URL;

let redisClient = null;

// Only create Redis client if URL is configured
if (redisConnection) {
  redisClient = new Redis(redisConnection, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times) {
      // Stop retrying after 10 attempts (about 10 seconds)
      if (times > 10) {
        console.warn(
          "⚠️  Redis max retries reached, stopping reconnection attempts"
        );
        return null; // Stop retrying
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true, // Don't connect immediately
  });

  // Handle Redis errors gracefully to prevent crashes
  redisClient.on("error", (err) => {
    console.error("⚠️  Redis client error:", err.message);
  });

  redisClient.on("close", () => {
    console.log("ℹ️  Redis connection closed");
  });

  redisClient.on("reconnecting", () => {
    console.log("🔄 Redis reconnecting...");
  });

  redisClient.on("connect", () => {
    console.log("✅ Redis connected");
  });
} else {
  console.warn(
    "⚠️  REDIS_URL not configured - Redis features will be disabled"
  );
}

async function waitForRedis() {
  if (!redisClient) {
    throw new Error("Redis client not configured - REDIS_URL is missing");
  }

  try {
    // Explicitly connect if not already connected
    if (redisClient.status === "wait" || redisClient.status === "end") {
      await redisClient.connect();
    }
    await redisClient.ping();
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Check if Redis is currently available
 * @returns {boolean} true if Redis is connected and ready
 */
function isRedisAvailable() {
  if (!redisClient) return false;
  return redisClient.status === "ready" || redisClient.status === "connecting";
}

/**
 * Safe wrapper for Redis operations
 * Returns null if Redis is unavailable instead of throwing
 */
async function safeRedisOperation(operation, fallback = null) {
  if (!isRedisAvailable()) {
    console.warn("⚠️  Redis not available, skipping operation");
    return fallback;
  }

  try {
    return await operation();
  } catch (error) {
    console.error("❌ Redis operation failed:", error.message);
    return fallback;
  }
}

export { redisClient, waitForRedis, isRedisAvailable, safeRedisOperation };
