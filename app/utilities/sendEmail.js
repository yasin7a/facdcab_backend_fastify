import fs from "fs";
import path from "path";
import throwError from "./throwError.js";
// const {
//   SESClient,
//   SendEmailCommand,
//   SendRawEmailCommand,
// } = require("@aws-sdk/client-ses");
import serverConfig from "../../config/server.config.js";
const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = serverConfig;
// make dumma class
class SESClient {
  constructor(config) {
    this.config = config;
  }
  async send(command) {
    // Dummy send function
    return { MessageId: "dummy-message-id" };
  }
}
class SendEmailCommand {
  constructor(params) {
    this.params = params;
  }
}
class SendRawEmailCommand {
  constructor(params) {
    this.params = params;
  }
}
// End of dummy classes

const ses = new SESClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const defaultFromEmail = "Skillscaper <no-reply@mail.skillscaper.com>";
async function sendEmail({
  to,
  subject,
  message = null,
  htmlContent = null,
  textContent = null,
  attachments = [],
  from = null,
}) {
  try {
    // If attachments exist, use raw email
    if (attachments && attachments.length > 0) {
      return await sendRawEmailWithAttachments({
        to,
        subject,
        message,
        htmlContent,
        attachments,
        from,
      });
    }

    // Standard email without attachments
    const params = {
      Destination: {
        ToAddresses: Array.isArray(to) ? to : [to],
      },
      Message: {
        Body: {},
        Subject: { Data: subject },
      },
      Source: from || defaultFromEmail,
    };

    // HTML content
    if (htmlContent) {
      params.Message.Body.Html = { Data: htmlContent };
    }

    // Text content fallback
    const textData = textContent || message;
    if (textData) {
      params.Message.Body.Text = { Data: textData };
    }

    if (!htmlContent && !textData) {
      throw new Error(
        "Either message, textContent, or htmlContent must be provided"
      );
    }

    const command = new SendEmailCommand(params);
    const result = await ses.send(command);

    return { success: true, messageId: result.MessageId, data: result };
  } catch (error) {
    throw throwError(error?.statusCode, "Failed to send email", error);
  }
}

async function sendRawEmailWithAttachments({
  to,
  subject,
  message,
  htmlContent,
  attachments,
  from,
}) {
  try {
    const boundary = `----=_NextPart_${Date.now()}`;
    let rawMessage = "";

    // Email headers
    rawMessage += `From: ${from || defaultFromEmail}\n`;
    rawMessage += `To: ${Array.isArray(to) ? to.join(", ") : to}\n`;
    rawMessage += `Subject: ${subject}\n`;
    rawMessage += `MIME-Version: 1.0\n`;
    rawMessage += `Content-Type: multipart/mixed; boundary="${boundary}"\n\n`;

    // Body
    if (htmlContent && message) {
      const altBoundary = `----=_Alt_${Date.now()}`;
      rawMessage += `--${boundary}\n`;
      rawMessage += `Content-Type: multipart/alternative; boundary="${altBoundary}"\n\n`;

      // Text
      rawMessage += `--${altBoundary}\n`;
      rawMessage += `Content-Type: text/plain; charset=UTF-8\n\n`;
      rawMessage += `${message}\n\n`;

      // HTML
      rawMessage += `--${altBoundary}\n`;
      rawMessage += `Content-Type: text/html; charset=UTF-8\n\n`;
      rawMessage += `${htmlContent}\n\n`;

      rawMessage += `--${altBoundary}--\n\n`;
    } else if (htmlContent) {
      rawMessage += `--${boundary}\n`;
      rawMessage += `Content-Type: text/html; charset=UTF-8\n\n`;
      rawMessage += `${htmlContent}\n\n`;
    } else if (message) {
      rawMessage += `--${boundary}\n`;
      rawMessage += `Content-Type: text/plain; charset=UTF-8\n\n`;
      rawMessage += `${message}\n\n`;
    }

    // Attachments
    for (const attachment of attachments) {
      let fileData;
      if (attachment.data) {
        fileData = Buffer.isBuffer(attachment.data)
          ? attachment.data
          : Buffer.from(attachment.data);
      } else if (attachment.path) {
        fileData = await fs.promises.readFile(attachment.path);
      } else {
        throw new Error(
          'Attachment must have either "data" or "path" property'
        );
      }

      const base64Data = fileData.toString("base64");
      const filename =
        attachment.filename || path.basename(attachment.path || "attachment");

      rawMessage += `--${boundary}\n`;
      rawMessage += `Content-Type: ${
        attachment.contentType || "application/octet-stream"
      }\n`;
      rawMessage += `Content-Disposition: attachment; filename="${filename}"\n`;
      rawMessage += `Content-Transfer-Encoding: base64\n\n`;

      const base64Lines = base64Data.match(/.{1,76}/g) || [];
      rawMessage += base64Lines.join("\n") + "\n\n";
    }

    rawMessage += `--${boundary}--`;

    const command = new SendRawEmailCommand({
      RawMessage: { Data: Buffer.from(rawMessage) },
      Destinations: Array.isArray(to) ? to : [to],
      Source: from || defaultFromEmail,
    });

    const result = await ses.send(command);
    return { success: true, messageId: result.MessageId, data: result };
  } catch (error) {
    throw error;
  }
}

export default sendEmail;
