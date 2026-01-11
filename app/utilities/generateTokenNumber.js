/**
 * Generate a random token number for queue serial
 * Format: T followed by 3 random alphanumeric characters (e.g., T8A4, TB3X, TK9M)
 * @returns {string} Random token number
 */
function generateTokenNumber() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding similar looking chars like 0,O,1,I
  let token = "T";
  for (let i = 0; i < 3; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export default generateTokenNumber;
