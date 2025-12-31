// crypto-utils.js
import crypto from "crypto";
const ENCRYPTION_KEY = "OxyIAvuJZnbf3Rhg7K5vNwT+z3rpNjP0xF0v7h3Z4T4=";
const key = Buffer.from(ENCRYPTION_KEY, "base64");
if (key.length !== 32)
  throw new Error("ENCRYPTION_KEY must be 32 bytes base64!");

function encrypt(text) {
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${encrypted.toString(
    "base64"
  )}:${tag.toString("base64")}`;
}

function decrypt(payload) {
  const [ivB64, encryptedB64, tagB64] = payload.split(":");
  if (!ivB64 || !encryptedB64 || !tagB64) throw new Error("Invalid payload");

  const iv = Buffer.from(ivB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");
  const tag = Buffer.from(tagB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export { encrypt, decrypt };
