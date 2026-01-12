import * as applicationEmailWorker from "./application-email.worker.js";
// const smsWorker = require("./sms.worker");
// const notificationWorker = require("./notification.worker");

const workers = [];

const runWorkers = async () => {
  const worker = applicationEmailWorker.start();
  if (worker) {
    workers.push(worker);
  }
  // workers.push(smsWorker.start());
  // workers.push(notificationWorker.start());
};

const shutdownWorkers = async () => {
  if (workers.length === 0) return;

  console.log(`Shutting down ${workers.length} workers...`);
  await Promise.all(
    workers.map(async (worker) => {
      if (!worker) return;
      try {
        await worker.close();
      } catch (error) {
        console.error("Error closing worker:", error.message);
      }
    })
  );
  console.log("All workers shut down");
};

export { runWorkers, shutdownWorkers };
