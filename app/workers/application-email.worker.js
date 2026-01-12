import applicationMail from "../mail/applicationMail.js";
import { startWorker } from "./base.worker.js";

async function processEmail(job) {
  try {
    const emailData = job.data;

    if (!emailData) {
      throw new Error("No email data provided");
    }

    console.log(
      `📨 Processing email job #${job.id} for application #${emailData.application_id} (Status: ${emailData.status})`
    );
    await applicationMail(emailData);
    console.log(`✅ Email job #${job.id} completed successfully`);
  } catch (error) {
    console.error(`❌ Email job #${job.id} failed:`, error.message);
    throw error;
  }
}

function start() {
  return startWorker("send-application-queue", processEmail);
}

export { start };
