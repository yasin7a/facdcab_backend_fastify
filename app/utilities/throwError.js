import createError from "http-errors";
import httpStatus from "./httpStatus.js";

const throwError = (status, message, error = null) => {
  const modifiedMessage = error
    ? JSON.stringify({ message, error: error.message })
    : message;
  return createError(
    status || httpStatus.INTERNAL_SERVER_ERROR,
    modifiedMessage
  );
};
export default throwError;
