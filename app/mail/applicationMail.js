import serverConfig from "../../config/server.config.js";
import applicationMailTemplate from "../template/applicationMailTemplate.js";
import sendEmail from "../utilities/sendEmail.js";
import testSendMail from "../utilities/testSendMail.js";
import throwError from "../utilities/throwError.js";

const applicationMail = async (emailData) => {
  try {
    // Validate required email data
    if (!emailData?.email) {
      throw new Error("Email address is required");
    }

    const mail = mailTemplate({
      emailData,
    });

    // if (serverConfig.IS_PRODUCTION) {
    //   await sendEmail({
    //     to: mail.to,
    //     subject: mail.subject,
    //     htmlContent: mail.htmlContent,
    //   });
    // } else {
    await testSendMail({
      to: mail.to,
      subject: mail.subject,
      html: mail.htmlContent,
    });
    // }

    return true;
  } catch (error) {
    console.error("Email sending failed:", error);
    throw throwError(
      error?.statusCode || 500,
      `Email sending failed: ${error.message}`
    );
  }
};

const mailTemplate = ({ emailData }) => {
  let subject = "Application";
  return {
    to: emailData.email,
    subject: subject,
    htmlContent: applicationMailTemplate({ emailData }),
  };
};

export default applicationMail;
