import { queues } from "../queues/queue.js";

async function sendApplicationMail(emailData) {
  return await queues.sendApplicationQueue.add(
    "send-application-mail",
    emailData
  );
}

export { sendApplicationMail };
