import Redis from "ioredis";
import serverConfig from "./server.config.js";

const redisConnection = serverConfig.REDIS_URL;

const redisClient = new Redis(redisConnection, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

async function waitForRedis() {
  try {
    await redisClient.ping();
  } catch (error) {
    throw error;
  }
}

export { redisClient, waitForRedis };
