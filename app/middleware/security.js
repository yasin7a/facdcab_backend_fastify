import serverConfig from "../../config/server.config.js";
import throwError from "../utilities/throwError.js";
import httpStatus from "../utilities/httpStatus.js";
const { IS_PRODUCTION } = serverConfig;

const allowedClients = [
  "http://127.0.0.1:5500",
  "http://localhost:4173",
  "http://localhost:3000",
  "http://192.168.68.117:4173",
  "http://192.168.68.117:3000",
  "https://73gx9tch-3000.asse.devtunnels.ms",
  "https://nd45xqc5-3000.asse.devtunnels.ms",
  "https://xm4zblgt-3000.asse.devtunnels.ms",
  "https://nd45xqc5-3000.asse.devtunnels.ms",
  "https://1n5qdqhc-3000.asse.devtunnels.ms",
  "https://gdk1c646-3000.inc1.devtunnels.ms",
  "https://jx83mw1w-3000.asse.devtunnels.ms",
  "https://1n5qdqhc-9999.asse.devtunnels.ms",
  "https://c6hjkkw4-3000.asse.devtunnels.ms",
  "https://enter.skillscaper.com",
  "https://app.skillscaper.com",
];

const restrictAccess = async (request, reply) => {
  if (!IS_PRODUCTION) {
    return;
  }

  const url = request.url;
  if (
    // upload
    url === "/uploads" ||
    // google auth
    url === "/auth/google" ||
    url === "/auth/google/callback" ||
    // payment
    url === "/api/payment/return" ||
    url === "/api/payment/notify"
  ) {
    return;
  }

  const origin = request.headers.origin || request.headers.referer;

  if (origin && allowedClients.includes(origin)) {
    // Allow the request to proceed
    return;
  } else {
    // Forbidden: block the request
    throw throwError(
      httpStatus.FORBIDDEN,
      "Access forbidden: unauthorized client."
    );
  }
};

export default async (app) => {
  // Register Helmet for security headers
  const helmet = await import("@fastify/helmet");
  await app.register(helmet.default, {
    global: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  });

  // Register CORS
  const cors = await import("@fastify/cors");
  await app.register(cors.default, {
    origin: allowedClients,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    credentials: true,
  });

  // Register Compression
  const compress = await import("@fastify/compress");
  await app.register(compress.default, {
    global: true,
  });

  // Uncomment to enable access restriction
  // app.addHook("onRequest", restrictAccess);
};
