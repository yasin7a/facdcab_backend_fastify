import httpStatus from "./httpStatus.js";
import throwError from "./throwError.js";
import nodemailer from "nodemailer";

// async function testSendMail({ to, subject, html, attachments = [] }) {
//   try {
//     const response = await fetch("https://api.resend.com/emails", {
//       method: "POST",
//       headers: {
//         Authorization: "Bearer re_NfKMHNkJ_DbesPYQEwk7s15odP67v9dL9",
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         from: "alpha-dev@resend.dev",
//         to,
//         subject,
//         html,
//         attachments,
//       }),
//     });

//     if (!response.ok) {
//       const error = await response.json();
//       throw new Error(error.message || "Failed to send email");
//     }

//     return true;
//   } catch (error) {
//     throw throwError(
//       httpStatus.INTERNAL_SERVER_ERROR,
//       "Something went wrong with email delivery. Please try again",
//       error
//     );
//   }
// }

async function testSendMail({ to, subject, html, attachments = [] }) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "iftekharul15-2811@diu.edu.bd",
        pass: "zqlc igyh ejef yphe",
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 30000, // 30 seconds
    });

    await transporter.sendMail({
      from: `Test <iftekharul15-2811@diu.edu.bd>`,
      to,
      subject,
      html,
      attachments,
    });
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    throw throwError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Something went wrong with email delivery. Please try again",
      error
    );
  }
}

export default testSendMail;
