import httpStatus from "./httpStatus.js";

const sendResponse = (reply, code, message, data) => {
  let responseObject = {};
  responseObject.success = true;
  responseObject.code = code || httpStatus.OK;
  responseObject.endpoint = reply.request.url;
  responseObject.message = message || "data received successfully";
  responseObject.data = data;

  return reply.code(responseObject.code).send(responseObject);
};

export default sendResponse;
