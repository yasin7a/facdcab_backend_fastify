import crypto from "crypto";

function generateRandomId(length = 16) {
  return crypto.randomBytes(length).toString("hex");
}

export default generateRandomId;
