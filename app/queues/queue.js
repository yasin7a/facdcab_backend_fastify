import { Queue } from "bullmq";
import { redisClient } from "../../config/redis.config.js";

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
};

const queues = {};
let queuesInitialized = false;

/**
 * Initialize queues (called after Redis connection is established)
 */
function initializeQueues() {
  if (queuesInitialized || !redisClient) {
    return;
  }

  try {
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

    // Add more queues here as needed

    queuesInitialized = true;
    console.log("✅ Queues initialized with Redis");
  } catch (error) {
    console.error("❌ Failed to initialize queues:", error.message);
  }
}

// Auto-initialize if Redis client exists
if (redisClient) {
  initializeQueues();
} else {
  console.warn("⚠️  Queues disabled - REDIS_URL not configured");
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
export { queues, closeAllQueues, initializeQueues };
