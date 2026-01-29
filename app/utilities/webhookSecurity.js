// Webhook Security Utilities
import crypto from "crypto";

/**
 * Verify webhook signature from payment gateway
 * @param {Object} payload - Webhook payload
 * @param {string} signature - Signature from webhook header
 * @param {string} secret - Webhook secret key
 * @returns {boolean} True if signature is valid
 */
export function verifyWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }

  try {
    const payloadString =
      typeof payload === "string" ? payload : JSON.stringify(payload);

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payloadString)
      .digest("hex");

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  } catch (error) {
    console.error("[WebhookSecurity] Signature verification failed:", error);
    return false;
  }
}

/**
 * Verify webhook signature with multiple algorithms support
 * @param {Object} payload - Webhook payload
 * @param {string} signature - Signature from webhook header
 * @param {string} secret - Webhook secret key
 * @param {string} algorithm - Hash algorithm (default: sha256)
 * @returns {boolean} True if signature is valid
 */
export function verifyWebhookSignatureWithAlgorithm(
  payload,
  signature,
  secret,
  algorithm = "sha256",
) {
  if (!signature || !secret) {
    return false;
  }

  try {
    const payloadString =
      typeof payload === "string" ? payload : JSON.stringify(payload);

    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payloadString)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  } catch (error) {
    console.error("[WebhookSecurity] Signature verification failed:", error);
    return false;
  }
}

/**
 * Verify SSLCommerz webhook signature
 * SSLCommerz uses MD5 hash for validation
 * @param {Object} data - Webhook data from SSLCommerz
 * @param {string} storePassword - Store password from SSLCommerz
 * @returns {boolean} True if valid
 */
export function verifySSLCommerzWebhook(data, storePassword) {
  if (!data || !storePassword) {
    return false;
  }

  try {
    // SSLCommerz validation: val_id + store_id + store_passwd + amount + currency
    const validationString = `${data.val_id}${data.store_id}${storePassword}${data.amount}${data.currency_type}`;

    const hash = crypto
      .createHash("md5")
      .update(validationString)
      .digest("hex");

    return hash === data.verify_sign;
  } catch (error) {
    console.error("[WebhookSecurity] SSLCommerz verification failed:", error);
    return false;
  }
}

/**
 * Check if webhook is from allowed IP addresses
 * @param {string} requestIP - IP address from request
 * @param {Array<string>} allowedIPs - List of allowed IP addresses
 * @returns {boolean} True if IP is allowed
 */
export function verifyWebhookIP(requestIP, allowedIPs = []) {
  if (!allowedIPs || allowedIPs.length === 0) {
    // If no IP whitelist configured, allow all (not recommended for production)
    console.warn("[WebhookSecurity] No IP whitelist configured");
    return true;
  }

  return allowedIPs.includes(requestIP);
}

/**
 * Prevent replay attacks by checking timestamp
 * @param {number} timestamp - Timestamp from webhook (Unix timestamp)
 * @param {number} toleranceSeconds - Maximum age of webhook in seconds (default: 300 = 5 minutes)
 * @returns {boolean} True if timestamp is within tolerance
 */
export function verifyWebhookTimestamp(timestamp, toleranceSeconds = 300) {
  if (!timestamp) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;

  return age >= 0 && age <= toleranceSeconds;
}

/**
 * Complete webhook verification (signature + timestamp + IP)
 * @param {Object} options - Verification options
 * @returns {Object} Verification result
 */
export function verifyWebhook({
  payload,
  signature,
  secret,
  timestamp,
  requestIP,
  allowedIPs = [],
  toleranceSeconds = 300,
}) {
  const result = {
    valid: true,
    errors: [],
  };

  // Verify signature
  if (!verifyWebhookSignature(payload, signature, secret)) {
    result.valid = false;
    result.errors.push("Invalid signature");
  }

  // Verify timestamp (prevent replay attacks)
  if (timestamp && !verifyWebhookTimestamp(timestamp, toleranceSeconds)) {
    result.valid = false;
    result.errors.push("Timestamp out of tolerance (possible replay attack)");
  }

  // Verify IP (if whitelist configured)
  if (allowedIPs.length > 0 && !verifyWebhookIP(requestIP, allowedIPs)) {
    result.valid = false;
    result.errors.push("IP address not whitelisted");
  }

  return result;
}

export default {
  verifyWebhookSignature,
  verifyWebhookSignatureWithAlgorithm,
  verifySSLCommerzWebhook,
  verifyWebhookIP,
  verifyWebhookTimestamp,
  verifyWebhook,
};
