import jwt from "jsonwebtoken";
import serverConfig from "../../config/server.config.js";
const {
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES,
  DEVELOPMENT_PRODUCTION_UNSAFE_AUTH,
  COOKIE_DOMAIN,
} = serverConfig;
let cookieOption = {
  httpOnly: true,
  secure: true,

  // ...(COOKIE_DOMAIN
  //   ? {
  //       domain: serverConfig.COOKIE_DOMAIN, // only for shared cookies across subdomains
  //     }
  //   : {}),
  sameSite: "Lax",
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
    reply.setCookie("isSignedIn", "true", {
      ...cookieOptionWithAge,
      httpOnly: false,
      secure: false,
    });
  }

  return need_token ? accessToken : null;
};
export default generateToken;
