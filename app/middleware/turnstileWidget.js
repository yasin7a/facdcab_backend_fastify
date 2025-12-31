import serverConfig from "../../config/server.config.js";
import throwError from "../utilities/throwError.js";
import httpStatus from "../utilities/httpStatus.js";

const captchaErrorMsg = "Captcha verification failed, please try again!";

const turnstileWidget = async (request, reply) => {
  // skip captcha verification for development or production unsafe auth environment
  if (serverConfig.DISABLE_TURNSTILE_SECURITY) {
    return;
  }

  const token = request.headers["cft-token"];

  if (!token) {
    throw throwError(httpStatus.BAD_REQUEST, captchaErrorMsg);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret: serverConfig.CLOUDFLARE_SECRET_KEY,
        response: token,
        remoteip: request.ip, // optional
      }),
    }
  );

  if (!response.ok) {
    throw throwError(httpStatus.BAD_REQUEST, captchaErrorMsg);
  }

  const data = await response.json();
  if (!data.success) {
    throw throwError(httpStatus.BAD_REQUEST, captchaErrorMsg);
  }
};

export default turnstileWidget;
