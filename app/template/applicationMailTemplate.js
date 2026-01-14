import serverConfig from "../../config/server.config.js";

const applicationMailTemplate = ({ emailData }) => {
  // Validate required data
  if (!emailData?.email) {
    throw new Error("Missing required email data: email");
  }

  // Configuration
  const domain = serverConfig.CLIENT_URL;
  const logoUrl = `${domain}/images/logo.png`;

  // Helper functions
  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "Invalid Date";
    }
  };

  const safeGet = (obj, path, fallback = "N/A") => {
    try {
      return (
        path.split(".").reduce((curr, key) => curr?.[key], obj) || fallback
      );
    } catch {
      return fallback;
    }
  };

  // Reusable style objects
  const colors = {
    primary: "#006747",
    red: "#e53e3e",
    redDark: "#c53030",
    redBg: "#fff5f5",
    redBorder: "#fed7d7",
    green: "#38a169",
    greenDark: "#166534",
    greenBg: "#f0fdf4",
    greenBorder: "#c6f6d5",
    yellow: "#d69e2e",
    yellowDark: "#78350f",
    yellowBg: "#fffbeb",
    yellowBorder: "#faf089",
    gray: "#718096",
    grayDark: "#2d3748",
    grayText: "#4a5568",
    blue: "#2b6cb0",
    blueBg: "#f0f7ff",
    blueBorder: "#d0e3ff",
    teal: "#2c7a7b",
    tealBg: "#e6fffa",
    tealBorder: "#81e6d9",
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Document Verification Notice</title>
</head>
<body style="margin:0;padding:40px 0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e1e1e1;box-shadow:0 4px 6px rgba(0,0,0,0.05);overflow:hidden;">
    
    <!-- Header -->
    <div style="background:${colors.primary};padding:24px 30px;">
      <table style="width:100%;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:50px;vertical-align:middle;">
            <div style="background:white;border-radius:50%;width:50px;height:50px;text-align:center;line-height:50px;">
              <img src="${logoUrl}" alt="BD Flag" style="width:30px;height:auto;vertical-align:middle;">
            </div>
          </td>
          <td style="padding-left:18px;color:white;vertical-align:middle;">
            <h1 style="margin:0;font-size:20px;font-weight:600;">Bangladesh High Commission</h1>
            <p style="margin:2px 0 0;font-size:13px;opacity:0.85;">Document Verification Notice</p>
          </td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>`;
};

export default applicationMailTemplate;
