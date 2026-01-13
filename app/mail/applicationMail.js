import serverConfig from "../../config/server.config.js";
import applicationMailTemplate from "../template/applicationMailTemplate.js";
import sendEmail from "../utilities/sendEmail.js";
import testSendMail from "../utilities/testSendMail.js";
import throwError from "../utilities/throwError.js";
import { ApplicationStatus } from "../utilities/constant.js";
import { prisma } from "../lib/prisma.js";

const applicationMail = async (emailData) => {
  try {
    console.log(
      `📬 Preparing email for ${emailData.email} - Status: ${emailData.status}`
    );

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

    // Fetch office hours from database
    const officeHours = await prisma.officeHours.findFirst();

    // Format office hours for email template
    let officeHoursText = ""; // Default fallback

    if (officeHours) {
      const weekDays = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const workingDays = weekDays.filter(
        (_, index) => !officeHours.weekend_days.includes(index)
      );

      // Format time from 24hr to 12hr format
      const formatTime = (time) => {
        const [hours, minutes] = time.split(":");
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
      };

      const startTime = formatTime(officeHours.start_time);
      const endTime = formatTime(officeHours.end_time);

      // Create the working days range
      if (workingDays.length > 0) {
        const firstDay = workingDays[0];
        const lastDay = workingDays[workingDays.length - 1];
        officeHoursText = `${firstDay} - ${lastDay}, ${startTime} - ${endTime}`;
      }
    }

    // Add office hours to email data
    emailData.officeHours = officeHoursText;

    const mail = mailTemplate({
      emailData,
    });

    console.log(`📧 Sending email with subject: "${mail.subject}"`);

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

    console.log(`✅ Email sent successfully to ${mail.to}`);
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
    subject = "Documents Approved - Schedule Your Appointment";
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
