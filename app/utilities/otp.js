import serverConfig from "../../config/server.config.js";
import { prisma } from "../lib/prisma.js";
import httpStatus from "./httpStatus.js";
import sendEmail from "./sendEmail.js";
import sendResponse from "./sendResponse.js";
import testSendMail from "./testSendMail.js";
import throwError from "./throwError.js";

export const OTP_TYPE = {
  LOGIN: "LOGIN",
  REGISTER: "REGISTER",
  FORGOT: "FORGOT",
};

const OTP_TTL_MINUTES = 10; // 10 minutes
const getOtpExpiry = () => new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

function otpGen() {
  let otp = "";
  let otpLength = Number(6) - 1;
  for (let i = 0; i <= otpLength; i++) {
    const randomValue = Math.round(Math.random() * 9);
    otp += randomValue;
  }
  return otp;
}

const otpMailTemplate = (email, otp, type) => {
  const logoUrl = `https://enter.skillscaper.com/assets/logo.png`;
  return {
    to: email,
    subject:
      type === OTP_TYPE.FORGOT
        ? "Forgot Password Access Code"
        : "Your Access Code",
    htmlContent: `<div style="max-width:600px; margin:0 auto; padding:40px; border:1px solid #e5e7eb; border-radius:16px; background:linear-gradient(135deg,#fdfdfd,#f7f9fc); box-shadow:0 6px 18px rgba(0,0,0,0.08); font-family:'Segoe UI', Arial, sans-serif;">

  <div style="text-align:center; margin:36px 0;">
    <img src="${logoUrl}" alt="Logo" style="width:168px; height:auto;">
  </div>

<h1 style="color: #0f172a; text-align: center; margin-bottom: 24px; font-size: 26px; font-weight: 600;">
🔒 Verify
</h1>


  <p style="font-size:16px; color:#334155; margin:0 0 12px 0;">Hello,</p>

  <p style="font-size:16px; color:#334155; margin:0 0 20px 0;">
    Please use your one-time verification code below to continue.<br/>
  </p>

  <div style="text-align:center; margin:36px 0;">
    <span style="font-size:28px; font-weight:bold; letter-spacing:6px; background:#2563eb; color:#ffffff; padding:18px 32px; border-radius:12px; display:inline-block; box-shadow:0 6px 14px rgba(37,99,235,0.3); font-family:monospace;">
      ${otp}
    </span>
  </div>

   <p style="font-size:16px; color:#334155; margin:0 0 20px 0;">
    This code will expire in <strong style="color:#dc2626;">10 minutes</strong>.
  </p>

  <p style="font-size:14px; color:#64748b; margin:0 0 20px 0;">
    If you did not request this code, you can safely ignore this email.
  </p>

  <hr style="border:none; border-top:1px solid #e2e8f0; margin:32px 0;">

  <p style="font-size:12px; color:#94a3b8; text-align:center; margin:0;">
    &copy; ${new Date().getFullYear()} <strong style="color:#2563eb;">Company</strong>. All rights reserved.
  </p>
</div>
`,
  };
};

const otpSendMail = async (email, otp, type) => {
  try {
    const otpMail = otpMailTemplate(email, otp, type);
    // if (serverConfig.IS_PRODUCTION) {
    //   await sendEmail({
    //     to: otpMail.to,
    //     subject: otpMail.subject,
    //     htmlContent: otpMail.htmlContent,
    //   });
    // } else {
      await testSendMail({
        to: otpMail.to,
        subject: otpMail.subject,
        html: otpMail.htmlContent,
      });
    // }

    return true;
  } catch (error) {
    throw throwError(error?.statusCode, error.message);
  }
};

const otpInit = async (email, otp, type) => {
  if (!OTP_TYPE[type]) {
    throw throwError(httpStatus.BAD_REQUEST, "Invalid OTP type.");
  }
  try {
    await prisma.otpVerification.upsert({
      where: {
        email_type: {
          email,
          type,
        },
      },
      update: {
        otp,
        otp_expiry: getOtpExpiry(),
      },
      create: {
        email,
        otp,
        type,
        otp_expiry: getOtpExpiry(),
      },
    });
    return true;
  } catch (error) {
    throw throwError(error?.statusCode, error.message);
  }
};

const deleteOtp = async (email, type) => {
  if (!OTP_TYPE[type]) {
    throw throwError(httpStatus.BAD_REQUEST, "Invalid OTP type.");
  }
  try {
    await prisma.otpVerification.delete({
      where: {
        email_type: {
          email,
          type,
        },
      },
    });
    return true;
  } catch (error) {
    throw throwError(error?.statusCode, error.message);
  }
};
const checkOtp = async (email, otp, type) => {
  if (!OTP_TYPE[type]) {
    throw throwError(httpStatus.BAD_REQUEST, "Invalid OTP type.");
  }
  try {
    let otpVerification = await prisma.otpVerification.findUnique({
      where: {
        email_type: {
          email,
          type,
        },
      },
    });

    if (otpVerification?.otp !== otp) {
      throw throwError(httpStatus.BAD_REQUEST, "Invalid OTP");
    }
    if (otpVerification?.otp_expiry < new Date()) {
      throw throwError(httpStatus.BAD_REQUEST, "OTP expired");
    }
    return true;
  } catch (error) {
    throw throwError(error?.statusCode, error.message);
  }
};

const iniOTPForRoute = async (email, type, message = null, reply) => {
  if (!OTP_TYPE[type]) {
    throw throwError(httpStatus.BAD_REQUEST, "Invalid OTP type.");
  }
  const otp = otpGen();
  await otpInit(email, otp, type);
  await otpSendMail(email, otp, type);

  return sendResponse(reply, httpStatus.OK, message, {
    otp_type: type,
  });
};

export {
  checkOtp,
  deleteOtp,
  getOtpExpiry,
  iniOTPForRoute,
  otpGen,
  otpInit,
  otpSendMail,
};
