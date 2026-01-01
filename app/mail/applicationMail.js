import serverConfig from "../../config/server.config.js";
import sendEmail from "../utilities/sendEmail.js";
import testSendMail from "../utilities/testSendMail.js";
import throwError from "../utilities/throwError.js";

const domain = serverConfig.CLIENT_URL;
const logoUrl = ``;

const applicationMail = async (emailData) => {
  try {
    const mail = mailTemplate({
      emailData,
    });
    if (serverConfig.IS_PRODUCTION) {
      await sendEmail({
        to: mail.to,
        subject: mail.subject,
        htmlContent: mail.htmlContent,
      });
    } else {
      await testSendMail({
        to: mail.to,
        subject: mail.subject,
        html: mail.htmlContent,
      });
    }
    return true;
  } catch (error) {
    throw throwError(error?.statusCode, error.message);
  }
};

const mailTemplate = ({ emailData }) => {
  return {
    to: emailData.email,
    subject: "Application send mail",
    htmlContent: applicationMailTemplate({ emailData }),
  };
};

const applicationMailTemplate = ({ emailData }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Invitation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto;">
        <h2>Application Invitation</h2>
        <p>Hello,${JSON.stringify(emailData)}</p>
        <p>Click the link below to accept the invitation:</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        <p style="font-size: 12px; color: #777;">If you believe you received this invitation in error, please ignore this email. ${domain}</p>
    </div>
</body>
</html>`;
};

export default applicationMail;
