import jwt from "jsonwebtoken";
import serverConfig from "../../config/server.config.js";
import extractAuthToken from "../utilities/extractAuthToken.js";
import httpStatus from "../utilities/httpStatus.js";
import throwError from "../utilities/throwError.js";

const verifyAuth = async (request, reply) => {
  const authHeader =
    request.headers.authorization || request.headers.Authorization;
  const tokenCookie = extractAuthToken(request.headers.cookie);

  if (!authHeader?.startsWith("Bearer "))
    throw throwError(httpStatus.UNAUTHORIZED, "Authentication failure!");

  const token = tokenCookie || authHeader.split(" ")[1];

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      serverConfig.ACCESS_TOKEN_SECRET,
      async (err, decoded) => {
        if (err) {
          reject(
            throwError(httpStatus.UNAUTHORIZED, "Authentication failure!")
          );
          return;
        }
        try {
          request.auth_id = decoded?.auth?.id;
          resolve();
        } catch (error) {
          reject(
            throwError(httpStatus.UNAUTHORIZED, "Authentication failure!")
          );
        }
      }
    );
  });
};

export default verifyAuth;
