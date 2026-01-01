import jwt from "jsonwebtoken";
import serverConfig from "../../config/server.config.js";
const {
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES,
  IS_PRODUCTION,
  DEVELOPMENT_PRODUCTION_UNSAFE_AUTH,
} = serverConfig;
let cookieOption = {
  // domain: IS_PRODUCTION ? serverConfig.COOKIE_DOMAIN : "localhost",
  httpOnly: true,
  secure: true,
  // sameSite: IS_PRODUCTION ? "none" : "lax",
  sameSite: "",
  path: "/",
};

let cookieOptionWithAge = {
  ...cookieOption,
  maxAge: parseInt(ACCESS_TOKEN_EXPIRES) * 24 * 60 * 60 * 1000,
};

let generateToken = async (
  auth,
  reply,
  need_token = false,
  setCookie = false
) => {
  const accessToken = jwt.sign({ auth }, ACCESS_TOKEN_SECRET, {
    algorithm: "HS256",
    expiresIn: parseInt(ACCESS_TOKEN_EXPIRES) + "d",
  });

  if (!DEVELOPMENT_PRODUCTION_UNSAFE_AUTH || setCookie) {
    reply.setCookie("auth_token", accessToken, cookieOptionWithAge);
  }

  return need_token ? accessToken : null;
};
export default generateToken;
