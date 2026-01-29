import toBoolean from "../app/utilities/toBoolean.js";
import dotenv from "dotenv";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
// if (!IS_PRODUCTION) {
// Load environment variables
dotenv.config();
// }

const serverConfig = {
  IS_PRODUCTION,
  PORT: process.env.PORT,

  DATABASE_URL: process.env.DATABASE_URL,
  PROJECT_NAME: process.env.PROJECT_NAME || "MyApp",

  // Access token configuration
  ACCESS_TOKEN_EXPIRES: process.env.ACCESS_TOKEN_EXPIRES,
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,

  CLIENT_URL: process.env.CLIENT_URL,
  BASE_URL: process.env.BASE_URL,

  // Upload path for Docker
  UPLOAD_PATH_DOCKER: "/app/uploads",
  // Mail Config
  MAIL: process.env.MAIL,
  MAILING_ID: process.env.MAILING_ID,
  MAILING_SECRET: process.env.MAILING_SECRET,
  MAILING_REFRESH: process.env.MAILING_REFRESH,
  MAIL_SERVICE: process.env.MAIL_SERVICE,
  MAIL_HOST: process.env.MAIL_HOST,
  MAIL_PORT: process.env.MAIL_PORT,
  MAIL_SECURE: process.env.MAIL_SECURE,

  // Cloudflare Config
  CLOUDFLARE_SECRET_KEY: process.env.CLOUDFLARE_SECRET_KEY,

  POST_HOG_API_KEY: process.env.POST_HOG_API_KEY,
  POST_HOG_HOST: process.env.POST_HOG_HOST,

  // Google oauth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  // Redis Config
  REDIS_URL: process.env.REDIS_URL,
  SUPER_ADMIN_MAIL: process.env.SUPER_ADMIN_MAIL || "admin@gmail.com",
  DISABLE_TURNSTILE_SECURITY: toBoolean(process.env.DISABLE_TURNSTILE_SECURITY),
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || "",
  DEVELOPMENT_PRODUCTION_UNSAFE_AUTH: toBoolean(
    process.env.DEVELOPMENT_PRODUCTION_UNSAFE_AUTH,
  ),

  // Currency Config
  CURRENCY: process.env.CURRENCY || "BDT",
};
export default serverConfig;
