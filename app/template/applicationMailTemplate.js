import serverConfig from "../../config/server.config.js";
import { DocumentStatus, ApplicationStatus } from "../utilities/constant.js";
const domain = serverConfig.CLIENT_URL;
const logoUrl = `${domain}/images/logo.png`;
const applicationMailTemplate = ({ emailData }) => {
  const { application, document_category } = emailData;

  // Validate required data
  if (!emailData?.email || !emailData?.name || !emailData?.application_id) {
    throw new Error(
      "Missing required email data: email, name, or application_id"
    );
  }

  // Helper functions for template
  const formatDate = (date) => {
    try {
      if (!date) return "N/A";
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return "Invalid Date";
    }
  };

  const safeGet = (obj, path, fallback = "N/A") => {
    try {
      return (
        path.split(".").reduce((current, key) => current?.[key], obj) ||
        fallback
      );
    } catch {
      return fallback;
    }
  };

  // Get all documents with their status and review information
  const allDocuments = [];
  const rejectedDocuments = [];
  const approvedDocuments = [];
  const pendingDocuments = [];

  if (application?.application_people?.length) {
    application.application_people.forEach((person, personIndex) => {
      person.documents?.forEach((doc) => {
        const docWithPersonInfo = {
          ...doc,
          personIndex: personIndex + 1,
          personName:
            person.first_name && person.last_name
              ? `${person.first_name} ${person.last_name}`
              : `Person ${personIndex + 1}`,
          personRole: person.role || `Applicant ${personIndex + 1}`,
        };

        allDocuments.push(docWithPersonInfo);

        if (doc.status === DocumentStatus.REJECTED) {
          rejectedDocuments.push(docWithPersonInfo);
        } else if (doc.status === DocumentStatus.APPROVED) {
          approvedDocuments.push(docWithPersonInfo);
        } else {
          pendingDocuments.push(docWithPersonInfo);
        }
      });
    });
  }

  const rejectedCount = rejectedDocuments.length;
  const approvedCount = approvedDocuments.length;
  const pendingCount = pendingDocuments.length;
  const totalDocuments = allDocuments.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Verification Notice</title>
</head>
<body style="margin: 0; padding: 40px 0; background-color: #f4f4f4; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e1e1e1; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
        
        <div style="background-color: #006747; padding: 24px 30px;">
            <table style="width: 100%;" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="width: 50px; vertical-align: middle;">
                        <div style="background-color: white; border-radius: 50%; width: 50px; height: 50px; text-align: center; line-height: 50px;">
                            <img src=${logoUrl} alt="BD Flag" style="width: 30px; height: auto; vertical-align: middle;">
                        </div>
                    </td>
                    <td style="padding-left: 18px; color: white; vertical-align: middle;">
                        <h1 style="margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">Bangladesh High Commission</h1>
                        <p style="margin: 2px 0 0 0; font-size: 13px; opacity: 0.85;">Document Verification Notice</p>
                    </td>
                </tr>
            </table>
        </div>

        ${
          rejectedCount > 0
            ? `
        <div style="background-color: #fff5f5; border-left: 5px solid #e53e3e; padding: 18px 30px;">
            <div style="display: flex; align-items: center; margin-bottom: 6px;">
                <span style="color: #c53030; font-weight: 700; font-size: 15px;">Document Re-Upload Required</span>
            </div>
            <p style="margin: 0 0 0 0; font-size: 13px; color: #c53030; line-height: 1.4;">Some of your submitted documents have been rejected. Please review the reasons below and re-upload the corrected documents.</p>
        </div>
        `
            : ""
        }

        <div style="padding: 30px;">
            <p style="margin: 0 0 12px 0; font-size: 15px; color: #2d3748;">Dear <strong>${
              emailData?.name || "Valued Applicant"
            }</strong>,</p>
            <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.6; color: #4a5568;">Greetings from the Bangladesh High Commission. Thank you for submitting your appointment request and required documentation.</p>
            <p style="margin: 0 0 25px 0; font-size: 14px; line-height: 1.6; color: #4a5568;">${
              rejectedCount > 0
                ? "Following a thorough review of your submitted documents, our verification team has identified certain items that require correction or resubmission to proceed with your application. Please review the details below and take necessary action at your earliest convenience."
                : ""
            }</p>

            <div style="background-color: #f0f7ff; border-radius: 10px; padding: 22px; margin-bottom: 30px; border: 1px solid #d0e3ff;">
                <div style="margin-bottom: 18px; color: #2b6cb0;">
                    <strong style="font-size: 15px; letter-spacing: 0.3px;">Appointment Information</strong>
                </div>
                
                <table style="width: 100%; margin-bottom: 20px; font-size: 13px;" cellpadding="9" cellspacing="0">
                    <tr>
                        <td style="width: 50%; vertical-align: top;">
                            <div style="color: #718096; margin-bottom: 4px;">Appointment ID:</div>
                            <div style="font-weight: 600; color: #2d3748;">${
                              emailData?.application_id || "N/A"
                            }</div>
                        </td>
                        <td style="width: 50%; vertical-align: top;">
                            <div style="color: #718096; margin-bottom: 4px;">Service Category:</div>
                            <div style="font-weight: 600; color: #2d3748;">${safeGet(
                              document_category,
                              "name"
                            )}</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-top: 15px;">
                            <div style="color: #718096; margin-bottom: 4px;">Submitted Date:</div>
                            <div style="font-weight: 600; color: #2d3748;">${formatDate(
                              emailData?.created_at
                            )}</div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-top: 15px;">
                            <div style="color: #718096; margin-bottom: 4px;">Application Status:</div>
                            <div style="font-weight: 600; color: #2d3748;">${
                              emailData?.status || ApplicationStatus.PENDING
                            }</div>
                        </td>
                    </tr>
                </table>

                ${
                  totalDocuments > 0
                    ? `
                <div style="background-color: #e6fffa; border-radius: 6px; padding: 15px; border: 1px solid #81e6d9;">
                    <div style="color: #2c7a7b; font-weight: 600; margin-bottom: 10px; font-size: 13px;">Document Review Summary</div>
                    <table style="width: 100%; font-size: 12px;" cellpadding="8" cellspacing="0">
                        <tr>
                            <td style="text-align: center; width: 25%;">
                                <div style="font-weight: 700; font-size: 16px; color: #2d3748;">${totalDocuments}</div>
                                <div style="color: #718096; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; margin-top: 2px;">Total</div>
                            </td>
                            ${
                              approvedCount > 0
                                ? `
                            <td style="text-align: center; width: 25%;">
                                <div style="font-weight: 700; font-size: 16px; color: #38a169;">${approvedCount}</div>
                                <div style="color: #38a169; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; margin-top: 2px;">Approved</div>
                            </td>
                            `
                                : `<td style="width: 25%;"></td>`
                            }
                            ${
                              rejectedCount > 0
                                ? `
                            <td style="text-align: center; width: 25%;">
                                <div style="font-weight: 700; font-size: 16px; color: #e53e3e;">${rejectedCount}</div>
                                <div style="color: #e53e3e; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; margin-top: 2px;">Rejected</div>
                            </td>
                            `
                                : `<td style="width: 25%;"></td>`
                            }
                            ${
                              pendingCount > 0
                                ? `
                            <td style="text-align: center; width: 25%;">
                                <div style="font-weight: 700; font-size: 16px; color: #d69e2e;">${pendingCount}</div>
                                <div style="color: #d69e2e; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; margin-top: 2px;">Pending</div>
                            </td>
                            `
                                : `<td style="width: 25%;"></td>`
                            }
                        </tr>
                    </table>
                </div>
                `
                    : ""
                }
            </div>

            ${
              emailData?.status === ApplicationStatus.PENDING
                ? `
            <div style="background-color: #fffbeb; border-left: 4px solid #d69e2e; border-radius: 8px; padding: 18px 22px; margin-bottom: 25px;">
                <div style="color: #78350f; font-size: 14px; line-height: 1.6;">
                    ℹ️ <strong>Application Status: Under Review</strong>
                </div>
                <p style="margin: 8px 0 0 0; font-size: 13px; color: #78350f; line-height: 1.5;">
                    Your application and supporting documents are currently being reviewed by our consular team. We appreciate your patience during this process. You will receive a notification once the review is completed.
                </p>
            </div>
            `
                : emailData?.status === ApplicationStatus.APPROVED
                ? `
            <div style="background-color: #f0fdf4; border-left: 4px solid #38a169; border-radius: 8px; padding: 18px 22px; margin-bottom: 25px;">
                <div style="color: #166534; font-size: 14px; line-height: 1.6;">
                    ✓ <strong>Congratulations! Your Documents Have Been Approved</strong>
                </div>
                <p style="margin: 8px 0 0 0; font-size: 13px; color: #166534; line-height: 1.5;">
                    All your submitted documents have been verified and approved. You may now proceed to schedule your appointment by selecting an available date and time from your dashboard. We recommend completing this step at your earliest convenience to secure your preferred time slot.
                </p>
            </div>
            `
                : ""
            }

            ${
              rejectedCount > 0
                ? `
            <div style="margin-bottom: 18px; color: #c53030;">
                <strong style="font-size: 15px;">Rejected Documents (${rejectedCount})</strong>
            </div>

            ${rejectedDocuments
              .map(
                (doc, index) => `
            <table style="width: 100%; border: 1px solid #fed7d7; border-radius: 8px; margin-bottom: 18px;" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="padding: 14px 20px; background-color: #fff;">
                        <table style="width: 100%;" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="width: 60%; vertical-align: middle;">
                                    <table cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="vertical-align: middle; padding-right: 12px;">
                                                <span style="background: #e53e3e; color: white; border-radius: 50%; width: 22px; height: 22px; display: inline-block; text-align: center; line-height: 22px; font-size: 11px; font-weight: 700;">${
                                                  index + 1
                                                }</span>
                                            </td>
                                            <td style="vertical-align: middle;">
                                                <div style="font-weight: 600; font-size: 14px; color: #2d3748; margin-bottom: 2px;">${
                                                  doc.document_type?.name ||
                                                  "Unknown Document"
                                                }</div>
                                                <div style="font-size: 12px; color: #718096;">
                                                    ${doc.personName} (${
                  doc.personRole
                })
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                                <td style="width: 40%; vertical-align: middle; text-align: right;">
                                    <span style="background: #e53e3e; color: white; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Rejected</span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                ${
                  doc.review?.comment
                    ? `
                <tr>
                    <td style="padding: 0 15px 15px 15px;">
                        <div style="background-color: #fff5f5; padding: 15px; border-radius: 6px; border: 1px solid #feb2b2;">
                            <div style="font-size: 12px; font-weight: 700; color: #c53030; margin-bottom: 6px;">Rejection Reason:</div>
                            <div style="font-size: 12px; color: #742a2a; line-height: 1.5;">${
                              doc.review.comment
                            }</div>
                            ${
                              doc.review?.review_by
                                ? `
                            <div style="font-size: 11px; color: #a0adb8; margin-top: 8px; padding-top: 8px; border-top: 1px solid #feb2b2;">
                                Reviewed by: ${
                                  doc.review.review_by.first_name
                                } ${doc.review.review_by.last_name}
                                ${
                                  doc.review.created_at
                                    ? ` on ${formatDate(doc.review.created_at)}`
                                    : ""
                                }
                            </div>
                            `
                                : ""
                            }
                        </div>
                    </td>
                </tr>
                `
                    : ""
                }
            </table>
            `
              )
              .join("")}

            ${
              approvedCount > 0
                ? `
            <div style="margin-bottom: 18px; color: #38a169;">
                <strong style="font-size: 15px;">Approved Documents (${approvedCount})</strong>
            </div>
            ${approvedDocuments
              .map(
                (doc, index) => `
            <table style="width: 100%; border: 1px solid #c6f6d5; border-radius: 8px; margin-bottom: 12px;" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="padding: 12px 20px; background-color: #fff;">
                        <table style="width: 100%;" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="width: 60%; vertical-align: middle;">
                                    <table cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="vertical-align: middle; padding-right: 12px;">
                                                <span style="background: #38a169; color: white; border-radius: 50%; width: 22px; height: 22px; display: inline-block; text-align: center; line-height: 22px; font-size: 11px; font-weight: 700;">✓</span>
                                            </td>
                                            <td style="vertical-align: middle;">
                                                <div style="font-weight: 600; font-size: 14px; color: #2d3748; margin-bottom: 2px;">${
                                                  doc.document_type?.name ||
                                                  "Unknown Document"
                                                }</div>
                                                <div style="font-size: 12px; color: #718096;">
                                                    ${doc.personName} (${
                  doc.personRole
                })
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                                <td style="width: 40%; vertical-align: middle; text-align: right;">
                                    <span style="background: #38a169; color: white; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Approved</span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                ${
                  doc.review?.comment
                    ? `
                <tr>
                    <td style="padding: 0 15px 15px 15px;">
                        <div style="background-color: #f0fff4; padding: 12px; border-radius: 6px; border: 1px solid #c6f6d5;">
                            <div style="font-size: 12px; color: #276749; line-height: 1.5;">${
                              doc.review.comment
                            }</div>
                            ${
                              doc.review?.review_by
                                ? `
                            <div style="font-size: 11px; color: #68d391; margin-top: 6px; padding-top: 6px; border-top: 1px solid #c6f6d5;">
                                Reviewed by: ${
                                  doc.review.review_by.first_name
                                } ${doc.review.review_by.last_name}
                                ${
                                  doc.review.created_at
                                    ? ` on ${formatDate(doc.review.created_at)}`
                                    : ""
                                }
                            </div>
                            `
                                : ""
                            }
                        </div>
                    </td>
                </tr>
                `
                    : ""
                }
            </table>
            `
              )
              .join("")}
            `
                : ""
            }

            ${
              pendingCount > 0
                ? `
            <div style="margin-bottom: 18px; color: #d69e2e;">
                <strong style="font-size: 15px;">Pending Documents (${pendingCount})</strong>
            </div>
            ${pendingDocuments
              .map(
                (doc, index) => `
            <table style="width: 100%; border: 1px solid #faf089; border-radius: 8px; margin-bottom: 12px;" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="padding: 12px 20px; background-color: #fff;">
                        <table style="width: 100%;" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="width: 60%; vertical-align: middle;">
                                    <table cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="vertical-align: middle; padding-right: 12px;">
                                                <span style="background: #d69e2e; color: white; border-radius: 50%; width: 22px; height: 22px; display: inline-block; text-align: center; line-height: 22px; font-size: 11px; font-weight: 700;">⏳</span>
                                            </td>
                                            <td style="vertical-align: middle;">
                                                <div style="font-weight: 600; font-size: 14px; color: #2d3748; margin-bottom: 2px;">${
                                                  doc.document_type?.name ||
                                                  "Unknown Document"
                                                }</div>
                                                <div style="font-size: 12px; color: #718096;">
                                                    ${doc.personName} (${
                  doc.personRole
                })
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                                <td style="width: 40%; vertical-align: middle; text-align: right;">
                                    <span style="background: #d69e2e; color: white; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Under Review</span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
            `
              )
              .join("")}
            `
                : ""
            }

            <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 22px; margin: 30px 0;">
                <div style="margin-bottom: 12px; color: #92400e;">
                    <strong style="font-size: 14px;">⚠️ Immediate Action Required</strong>
                </div>
                <p style="font-size: 13px; margin: 0 0 12px 0; line-height: 1.5; color: #78350f;">To proceed with your application, please re-upload the corrected documents within <strong>48 hours (2 days)</strong> from the receipt of this email. Failure to comply within the specified timeframe may result in appointment cancellation.</p>
                <div style="margin: 15px 0;">
                    <div style="color: #92400e; font-weight: 600; font-size: 13px; margin-bottom: 8px;">Document Submission Requirements:</div>
                    <ul style="font-size: 12px; margin: 0; padding-left: 20px; color: #78350f; line-height: 1.8;">
                        <li>Clear and legible scanned copy or high-resolution photograph</li>
                        <li>All four corners of the document must be clearly visible</li>
                        <li>Accepted file formats: PDF, JPG, or PNG (Maximum file size: 5 MB per document)</li>
                        <li>Original, unedited documents only - any alterations will result in automatic rejection</li>
                        <li>Ensure proper orientation and adequate lighting for photographs</li>
                    </ul>
                </div>
            </div>

            <div style="text-align: center; margin-bottom: 10px;">
                <a href="${serverConfig.CLIENT_URL}/my-appointment/${
                    emailData?.application_id
                  }" style="background-color: #006747; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block;">
                    Upload All Documents Now
                </a>
                <p style="font-size: 11px; color: #a0aec0; margin-top: 15px;">Click the button above to access your document upload portal</p>
            </div>
            `
                : ``
            }

            <div style="background-color: #f8fafc; border-radius: 10px; padding: 25px; border: 1px solid #edf2f7; margin-top: 40px;">
                <strong style="font-size: 14px; color: #2d3748; display: block; margin-bottom: 15px;">Need Help?</strong>
                <p style="font-size: 12px; margin-bottom: 15px; color: #4a5568; line-height: 1.5;">If you have any questions or need assistance with your documents, please contact us:</p>
                <div style="font-size: 12px; color: #4a5568; line-height: 2;">
                    <div>Email: <span style="color: #2b6cb0;">info@bangladeshhighcommission.bd</span></div>
                    <div>Phone: <span style="font-weight: 600;">+880 2 9898989</span></div>
                    <div>Office Hours: Monday - Friday, 9:00 AM - 5:00 PM</div>
                </div>
            </div>
        </div>

        <div style="background-color: #1a202c; color: #a0aec0; padding: 40px 30px; text-align: center; font-size: 12px; line-height: 1.6;">
            <div style="font-weight: 700; color: white; margin-bottom: 8px; letter-spacing: 0.5px;">Embassy of Bangladesh Paris</div>
            <div style="margin-bottom: 25px; opacity: 0.8;">109 Av. Henri Martin, 75016 Paris, France</div>
            <div style="border-top: 1px solid #2d3748; padding-top: 25px; font-size: 11px; opacity: 0.6;">
                This is an automated email from Bangladesh High Commission. Please do not reply to this email.<br>
                &copy; 2025 Bangladesh High Commission. All rights reserved.
            </div>
        </div>
    </div>
</body>
</html>`;
};
export default applicationMailTemplate;
