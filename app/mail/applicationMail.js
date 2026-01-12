import serverConfig from "../../config/server.config.js";
import applicationMailTemplate from "../template/applicationMailTemplate.js";
import sendEmail from "../utilities/sendEmail.js";
import testSendMail from "../utilities/testSendMail.js";
import throwError from "../utilities/throwError.js";
import { ApplicationStatus } from "../utilities/constant.js";

const applicationMail = async (emailData) => {
  try {
    // Validate required email data
    if (!emailData?.email) {
      throw new Error("Email address is required");
    }

    if (!emailData?.name) {
      throw new Error("Recipient name is required");
    }

    if (!emailData?.application_id) {
      throw new Error("Application ID is required");
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
  // Dynamically set subject based on application status
  let subject = "Document Verification Notice - Bangladesh High Commission";

  if (emailData?.status === ApplicationStatus.APPROVED) {
    subject = "Documents Approved – Schedule Your Appointment";
  } else if (emailData?.status === ApplicationStatus.REJECTED) {
    subject = "Documents Require Correction";
  }

  return {
    to: emailData.email,
    subject: subject,
    htmlContent: applicationMailTemplate({ emailData }),
  };
};

export default applicationMail;
