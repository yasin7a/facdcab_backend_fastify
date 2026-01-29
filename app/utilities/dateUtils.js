/**
 * Timezone-aware date utilities for subscription system
 * Uses UTC internally but provides helpers for user timezone conversion
 */

/**
 * Get current UTC date/time
 * @returns {Date} Current date in UTC
 */
export function getCurrentUTC() {
  return new Date();
}

/**
 * Add time to a date (timezone-safe)
 * @param {Date} date - Base date
 * @param {Object} duration - Duration to add {months, days, years}
 * @returns {Date} New date with added duration
 */
export function addDuration(date, { months = 0, days = 0, years = 0 }) {
  const result = new Date(date);

  if (years > 0) {
    result.setUTCFullYear(result.getUTCFullYear() + years);
  }

  if (months > 0) {
    result.setUTCMonth(result.getUTCMonth() + months);
  }

  if (days > 0) {
    result.setUTCDate(result.getUTCDate() + days);
  }

  return result;
}

/**
 * Calculate subscription end date based on billing cycle
 * @param {Date} startDate - Subscription start date
 * @param {string} billingCycle - MONTHLY, SIX_MONTHLY, YEARLY, LIFETIME
 * @returns {Date} End date in UTC
 */
export function calculateEndDate(startDate, billingCycle) {
  const start = new Date(startDate);

  switch (billingCycle) {
    case "MONTHLY":
      return addDuration(start, { months: 1 });

    case "SIX_MONTHLY":
      return addDuration(start, { months: 6 });

    case "YEARLY":
      return addDuration(start, { years: 1 });

    case "LIFETIME":
      return addDuration(start, { years: 100 });

    default:
      throw new Error(`Invalid billing cycle: ${billingCycle}`);
  }
}

/**
 * Check if a date is in the past (UTC)
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export function isPast(date) {
  return new Date(date) < getCurrentUTC();
}

/**
 * Check if a date is in the future (UTC)
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is in the future
 */
export function isFuture(date) {
  return new Date(date) > getCurrentUTC();
}

/**
 * Get days between two dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Number of days (can be negative)
 */
export function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end - start;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get start of day in UTC
 * @param {Date} date - Input date
 * @returns {Date} Start of day in UTC
 */
export function startOfDayUTC(date) {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day in UTC
 * @param {Date} date - Input date
 * @returns {Date} End of day in UTC
 */
export function endOfDayUTC(date) {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}

/**
 * Add days to a date
 * @param {Date} date - Base date
 * @param {number} days - Number of days to add
 * @returns {Date} New date
 */
export function addDays(date, days) {
  return addDuration(date, { days });
}

/**
 * Format date for database storage (ISO 8601 UTC)
 * @param {Date} date - Date to format
 * @returns {string} ISO 8601 formatted date string
 */
export function toISOString(date) {
  return new Date(date).toISOString();
}
