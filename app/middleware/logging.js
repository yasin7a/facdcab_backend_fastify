import winston from "winston";
import { createPostHogTransport } from "../lib/trackHog.js";
import serverConfig from "../../config/server.config.js";

function createLoggerInstance() {
  const isProd = serverConfig.IS_PRODUCTION;
  const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
      }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),

    transports: isProd
      ? [createPostHogTransport()]
      : [
          new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
          }),
        ],
    exitOnError: false,
  });

  return logger;
}

const logger = createLoggerInstance();

export default logger;
