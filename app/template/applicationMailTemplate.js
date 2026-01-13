import serverConfig from "../../config/server.config.js";
import { DocumentStatus, ApplicationStatus } from "../utilities/constant.js";

const applicationMailTemplate = ({ emailData }) => {
  const { application, document_category } = emailData;

  // Validate required data
  if (!emailData?.email || !emailData?.name || !emailData?.application_id) {
    throw new Error(
      "Missing required email data: email, name, or application_id"
    );
  }

  // Configuration
  const domain = serverConfig.CLIENT_URL;
  const logoUrl = `${domain}/images/logo.png`;
  const officeHours =
    emailData?.officeHours || "Sunday to Thursday, 9:00 AM - 5:00 PM";
  const appointmentUrl = `${domain}/my-appointment/${emailData?.application_id}`;
  const status = emailData?.status || ApplicationStatus.PENDING;
  const isApproved = status === ApplicationStatus.APPROVED;
  const isRejected = status === ApplicationStatus.REJECTED;
  const isPending = status === ApplicationStatus.PENDING;

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

  // Process documents
  const documents = { all: [], rejected: [], approved: [], pending: [] };

  application?.application_people?.forEach((person, idx) => {
    const personName =
      person.first_name && person.last_name
        ? `${person.first_name} ${person.last_name}`
        : `Person ${idx + 1}`;
    const personRole = person.role || `Applicant ${idx + 1}`;

    person.documents?.forEach((doc) => {
      const docInfo = { ...doc, personName, personRole };
      documents.all.push(docInfo);

      const statusMap = {
        [DocumentStatus.REJECTED]: documents.rejected,
        [DocumentStatus.APPROVED]: documents.approved,
      };
      (statusMap[doc.status] || documents.pending).push(docInfo);
    });
  });

  const { rejected, approved, pending, all } = documents;
  const hasRejected = rejected.length > 0;
  const hasApproved = approved.length > 0;
  const hasPending = pending.length > 0;
  const hasDocuments = all.length > 0;

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

  // Component builders
  const buildBadge = (color, text) => `
    <span style="background:${color};color:white;padding:4px 10px;border-radius:4px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">${text}</span>`;

  const buildCircle = (color, content, size = 22) => `
    <span style="background:${color};color:white;border-radius:50%;width:${size}px;height:${size}px;display:inline-block;text-align:center;line-height:${size}px;font-size:11px;font-weight:700;">${content}</span>`;

  // Get review styling based on document status color
  const getReviewStyle = (color) => {
    if (color === colors.red) {
      return {
        bg: colors.redBg,
        border: "#feb2b2",
        text: "#742a2a",
        label: "Rejection Reason:",
      };
    }
    if (color === colors.yellow) {
      return {
        bg: colors.yellowBg,
        border: colors.yellowBorder,
        text: colors.yellowDark,
        label: "Review Note:",
      };
    }
    return {
      bg: colors.greenBg,
      border: colors.greenBorder,
      text: "#276749",
      label: "",
    };
  };

  const buildDocumentRow = (doc, color, badge, icon) => {
    const reviewStyle = getReviewStyle(color);
    return "ok";
  };

  const buildDocSection = (docs, color, title, icon, badge) =>
    docs.length === 0
      ? ""
      : `
    <div style="margin-bottom:18px;color:${color};"><strong style="font-size:15px;">${icon} ${title} (${
          docs.length
        })</strong></div>
    ${docs
      .map(
        (doc, i) => `
      <table style="width:100%;border:1px solid ${
        color === colors.red
          ? colors.redBorder
          : color === colors.green
          ? colors.greenBorder
          : colors.yellowBorder
      };border-radius:8px;margin-bottom:12px;" cellpadding="0" cellspacing="0">
        ${buildDocumentRow(
          doc,
          color,
          badge,
          color === colors.red ? i + 1 : color === colors.green ? "✓" : "⏳"
        )}
      </table>`
      )
      .join("")}`;

  const buildCTA = (text, subtext) => `
    <div style="text-align:center;margin:25px 0;">
      <a href="${appointmentUrl}" style="background:${colors.primary};color:white;padding:16px 40px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">${text}</a>
      <p style="font-size:11px;color:#a0aec0;margin-top:15px;">${subtext}</p>
    </div>`;

  const buildStatBox = (count, label, color) =>
    count > 0
      ? `
    <td style="text-align:center;width:25%;">
      <div style="font-weight:700;font-size:16px;color:${color};">${count}</div>
      <div style="color:${color};text-transform:uppercase;font-size:10px;letter-spacing:0.5px;margin-top:2px;">${label}</div>
    </td>`
      : `<td style="width:25%;"></td>`;

  // Status-specific content
  const getStatusContent = () => {
    if (isRejected)
      return `
      <div style="background:${colors.redBg};border-left:5px solid ${
        colors.red
      };border-radius:10px;padding:30px 25px;margin:25px 0;text-align:center;">
        <div style="display:inline-block;background:${
          colors.red
        };border-radius:50%;width:60px;height:60px;line-height:60px;font-size:30px;color:white;margin-bottom:15px;">✕</div>
        <div style="color:${
          colors.redDark
        };font-size:18px;font-weight:700;margin-bottom:8px;">Application Rejected</div>
        <div style="color:#742a2a;font-size:14px;line-height:1.5;">Your appointment application has been rejected following a review of your submitted documents.</div>
        <div style="background:#fff;border-radius:8px;padding:20px;border:1px solid #feb2b2;margin-top:20px;text-align:left;">
          <div style="color:${
            colors.redDark
          };font-weight:600;font-size:13px;margin-bottom:10px;">Application ID: ${
        emailData?.application_id || "N/A"
      }</div>
          <div style="color:#742a2a;font-size:13px;line-height:1.6;">Unfortunately, we are unable to proceed with your appointment request at this time. Please review the rejection reasons listed below for each document.</div>
        </div>
      </div>`;

    if (isApproved)
      return `<p style="margin:0 0 25px;font-size:14px;line-height:1.6;color:${colors.grayText};">We are pleased to inform you that all your submitted documents have been reviewed and approved by our verification team.</p>`;

    return `<p style="margin:0 0 25px;font-size:14px;line-height:1.6;color:${
      colors.grayText
    };">${
      hasRejected
        ? "Following a thorough review of your submitted documents, our verification team has identified certain items that require correction or resubmission to proceed with your application."
        : "Your documents are currently under review by our verification team. We will notify you promptly once the review process is complete."
    }</p>`;
  };

  const getAlertBox = () => {
    if (isApproved)
      return `
      <div style="background:${colors.greenBg};border-left:4px solid ${colors.green};border-radius:8px;padding:18px 22px;margin-bottom:25px;">
        <div style="color:${colors.greenDark};font-size:14px;">✅ <strong>Congratulations! Your Documents Have Been Approved</strong></div>
        <p style="margin:8px 0 0;font-size:13px;color:${colors.greenDark};line-height:1.5;">All your submitted documents have been verified and approved. You may now proceed to schedule your appointment by selecting an available date and time from your dashboard.</p>
      </div>`;

    if (isPending && !hasRejected)
      return `
      <div style="background:${colors.yellowBg};border-left:4px solid ${colors.yellow};border-radius:8px;padding:18px 22px;margin-bottom:25px;">
        <div style="color:${colors.yellowDark};font-size:14px;">⏳ <strong>Application Status: Under Review</strong></div>
        <p style="margin:8px 0 0;font-size:13px;color:${colors.yellowDark};line-height:1.5;">Your application and supporting documents are currently being reviewed by our consular team. You will receive a notification once the review is completed.</p>
      </div>`;

    return "";
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

    <!-- Alert Banner -->
    ${
      hasRejected
        ? `
    <div style="background:${colors.redBg};border-left:5px solid ${colors.red};padding:18px 30px;">
      <strong style="color:${colors.redDark};font-size:15px;">⚠️ Document Re-Upload Required</strong>
      <p style="margin:6px 0 0;font-size:13px;color:${colors.redDark};line-height:1.4;">Some of your submitted documents have been rejected. Please review the reasons below and re-upload the corrected documents within 48 hours.</p>
    </div>`
        : ""
    }

    <!-- Main Content -->
    <div style="padding:30px;">
      <p style="margin:0 0 12px;font-size:15px;color:${
        colors.grayDark
      };">Dear <strong>${emailData?.name || "Valued Applicant"}</strong>,</p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${
        colors.grayText
      };">Greetings from the Bangladesh High Commission. Thank you for submitting your appointment request and required documentation.</p>

      ${getStatusContent()}

      <!-- Appointment Information -->
      <div style="background:${
        colors.blueBg
      };border-radius:10px;padding:22px;margin-bottom:30px;border:1px solid ${
    colors.blueBorder
  };">
        <strong style="font-size:15px;color:${
          colors.blue
        };">📋 Appointment Information</strong>
        <table style="width:100%;margin:18px 0 20px;font-size:13px;" cellpadding="9" cellspacing="0">
          <tr>
            <td style="width:50%;vertical-align:top;">
              <div style="color:${
                colors.gray
              };margin-bottom:4px;">Appointment ID:</div>
              <div style="font-weight:600;color:${colors.grayDark};">${
    emailData?.application_id || "N/A"
  }</div>
            </td>
            <td style="width:50%;vertical-align:top;">
              <div style="color:${
                colors.gray
              };margin-bottom:4px;">Service Category:</div>
              <div style="font-weight:600;color:${colors.grayDark};">${safeGet(
    document_category,
    "name"
  )}</div>
            </td>
          </tr>
          <tr>
            <td style="padding-top:15px;vertical-align:top;">
              <div style="color:${
                colors.gray
              };margin-bottom:4px;">Submitted Date:</div>
              <div style="font-weight:600;color:${
                colors.grayDark
              };">${formatDate(emailData?.created_at)}</div>
            </td>
            <td style="padding-top:15px;vertical-align:top;">
              <div style="color:${
                colors.gray
              };margin-bottom:4px;">Application Status:</div>
              <div style="font-weight:600;color:${
                colors.grayDark
              };">${status}</div>
            </td>
          </tr>
        </table>

        ${
          hasDocuments
            ? `
        <div style="background:${
          colors.tealBg
        };border-radius:6px;padding:15px;border:1px solid ${
                colors.tealBorder
              };">
          <div style="color:${
            colors.teal
          };font-weight:600;margin-bottom:10px;font-size:13px;">📊 Document Review Summary</div>
          <table style="width:100%;font-size:12px;" cellpadding="8" cellspacing="0">
            <tr>
              <td style="text-align:center;width:25%;">
                <div style="font-weight:700;font-size:16px;color:${
                  colors.grayDark
                };">${all.length}</div>
                <div style="color:${
                  colors.gray
                };text-transform:uppercase;font-size:10px;margin-top:2px;">Total</div>
              </td>
              ${buildStatBox(approved.length, "Approved", colors.green)}
              ${buildStatBox(rejected.length, "Rejected", colors.red)}
              ${buildStatBox(pending.length, "Pending", colors.yellow)}
            </tr>
          </table>
        </div>`
            : ""
        }
      </div>

      ${getAlertBox()}

      <!-- Document Sections -->
      ${buildDocSection(
        rejected,
        colors.red,
        "Rejected Documents",
        "❌",
        "Rejected"
      )}
      
      ${
        hasRejected
          ? `
      <div style="background:${
        colors.yellowBg
      };border:1px solid #fef3c7;border-radius:10px;padding:22px;margin:25px 0;">
        <strong style="font-size:14px;color:#92400e;">⚠️ Immediate Action Required</strong>
        <p style="font-size:13px;margin:12px 0;line-height:1.5;color:${
          colors.yellowDark
        };">To proceed with your application, please re-upload the corrected documents within <strong>48 hours (2 days)</strong>. Failure to comply may result in appointment cancellation.</p>
        <div style="color:#92400e;font-weight:600;font-size:13px;margin-bottom:8px;">Document Submission Requirements:</div>
        <ul style="font-size:12px;margin:0;padding-left:20px;color:${
          colors.yellowDark
        };line-height:1.8;">
          <li>Clear and legible scanned copy or high-resolution photograph</li>
          <li>All four corners of the document must be clearly visible</li>
          <li>Accepted formats: PDF, JPG, or PNG (Max 5 MB per document)</li>
          <li>Original, unedited documents only</li>
          <li>Ensure proper orientation and adequate lighting</li>
        </ul>
      </div>
      ${buildCTA(
        "Upload Corrected Documents Now",
        "Click the button above to access your document upload portal"
      )}`
          : ""
      }

      ${buildDocSection(
        approved,
        colors.green,
        "Approved Documents",
        "✅",
        "Approved"
      )}
      ${buildDocSection(
        pending,
        colors.yellow,
        "Pending Documents",
        "⏳",
        "Under Review"
      )}

      ${
        isApproved
          ? buildCTA(
              "Schedule Your Appointment",
              "Click the button above to select your preferred appointment date and time"
            )
          : ""
      }

      <!-- Help Section -->
      <div style="background:#f8fafc;border-radius:10px;padding:25px;border:1px solid #edf2f7;margin-top:40px;">
        <strong style="font-size:14px;color:${
          colors.grayDark
        };display:block;margin-bottom:15px;">❓ Need Help?</strong>
        <p style="font-size:12px;margin-bottom:15px;color:${
          colors.grayText
        };line-height:1.5;">If you have any questions or need assistance with your ${
    hasRejected ? "documents" : "application"
  }, please contact us:</p>
        <div style="font-size:12px;color:${colors.grayText};line-height:2;">
          <div>📧 Email: <span style="color:${
            colors.blue
          };">info@bangladeshhighcommission.bd</span></div>
          <div>📞 Phone: <strong>+880 2 9898989</strong></div>
          <div>🕐 Office Hours: ${officeHours}</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#1a202c;color:#a0aec0;padding:40px 30px;text-align:center;font-size:12px;line-height:1.6;">
      <div style="font-weight:700;color:white;margin-bottom:8px;">Embassy of Bangladesh Paris</div>
      <div style="margin-bottom:25px;opacity:0.8;">109 Av. Henri Martin, 75016 Paris, France</div>
      <div style="border-top:1px solid #2d3748;padding-top:25px;font-size:11px;opacity:0.6;">
        This is an automated email from Bangladesh High Commission. Please do not reply to this email.<br>
        &copy; 2025 Bangladesh High Commission. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>`;
};

export default applicationMailTemplate;
