import crypto from "crypto";

function generatePassword(options = {}) {
  const adjectives = [
    "Blue",
    "Silver",
    "Quiet",
    "Brave",
    "Lucky",
    "Happy",
    "Sharp",
    "Calm",
    "Bold",
    "Swift",
  ];
  const nouns = [
    "Tiger",
    "River",
    "Falcon",
    "Rocket",
    "Pixel",
    "Garden",
    "Storm",
    "Arrow",
    "Slate",
    "Wolf",
  ];

  const {
    digits = true,
    symbol = true,
    digitCount = 2,
    minLength = 8,
  } = options;

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const adj = pick(adjectives);
  const noun = pick(nouns);

  let password = adj + noun; // e.g. BlueTiger

  if (symbol) {
    const symbols = ["!", "@", "#", "$", "%", "?", "*", "-", "_"];
    const sym = pick(symbols);
    const insertAt = Math.floor(password.length / 2);
    password = password.slice(0, insertAt) + sym + password.slice(insertAt);
  }

  if (digits) {
    const num = String(
      Math.floor(Math.random() * Math.pow(10, digitCount))
    ).padStart(digitCount, "0");
    password += num;
  }

  // Ensure minimum length (pad with random letters if too short)
  if (password.length < minLength) {
    const extra = crypto
      .randomBytes(minLength - password.length)
      .toString("base64")
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, minLength - password.length);
    password += extra;
  }

  return password;
}

export default generatePassword;
