import { Queue } from "bullmq";
import { redisClient, isRedisAvailable } from "../../config/redis.config.js";

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
};

const queues = {};

// Only initialize queues if Redis is available
if (redisClient && isRedisAvailable()) {
  queues.sendApplicationQueue = new Queue("send-application-queue", {
    connection: redisClient,
    defaultJobOptions,
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  });
  console.log("✅ Queues initialized with Redis");
} else {
  console.warn("⚠️  Queues disabled - Redis not available");
}

async function closeAllQueues() {
  try {
    for (const [name, queue] of Object.entries(queues)) {
      await queue.close();
    }
  } catch (error) {
    throw error;
  }
}
export { queues, closeAllQueues };
