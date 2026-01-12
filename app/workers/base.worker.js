import { redisClient, isRedisAvailable } from "../../config/redis.config.js";
import { Worker } from "bullmq";

function startWorker(queueName, processor, options = {}) {
  if (!redisClient || !isRedisAvailable()) {
    console.warn(`⚠️  Worker '${queueName}' not started - Redis not available`);
    return null;
  }

  const worker = new Worker(queueName, processor, {
    connection: redisClient,
    concurrency: options.concurrency || 5,
    limiter: options.limiter || { max: 10, duration: 1000 },
  });

  worker.on("completed", (job) => {
    console.log(`[${queueName}] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[${queueName}] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error(`[${queueName}] Worker error:`, err.message);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`[${queueName}] Job ${jobId} stalled`);
  });

  return worker;
}

export { startWorker };
