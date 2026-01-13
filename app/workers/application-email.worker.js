import applicationMail from "../mail/applicationMail.js";
import { startWorker } from "./base.worker.js";

async function processEmail(job) {
  try {
    const emailData = job.data;

    if (!emailData) {
      throw new Error("No email data provided");
    }

    await applicationMail(emailData);
  } catch (error) {
    console.error(`❌ Email job #${job.id} failed:`, error.message);
    throw error;
  }
}

function start() {
  return startWorker("send-application-queue", processEmail);
}

export { start };
