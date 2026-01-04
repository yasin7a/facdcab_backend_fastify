const applicationMailTemplate = ({ emailData }) => {
  const { application, user, document_category } = emailData;

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
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "Invalid Date";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "APPROVED":
        return "#28a745";
      case "REJECTED":
        return "#dc3545";
      case "PENDING":
        return "#ffc107";
      default:
        return "#6c757d";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "APPROVED":
        return "✅";
      case "REJECTED":
        return "❌";
      case "PENDING":
        return "⏳";
      default:
        return "📋";
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Status Update</title>
    <style>
        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .document-card {
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            background-color: #f8f9fa;
        }
        .timeline-item {
            border-left: 3px solid #007bff;
            padding-left: 15px;
            margin: 10px 0;
            position: relative;
        }
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -6px;
            top: 5px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: #007bff;
        }
        .summary-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
    </style>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; padding: 20px; background-color: #f5f5f5;">
    <div style="max-width: 800px; margin: 0 auto; background-color: white; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); overflow: hidden;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">📋 Application Status Update</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Application ID: #${
              emailData?.application_id || "Unknown"
            }</p>
        </div>

        <div style="padding: 30px;">
            <!-- Greeting -->
            <h2 style="color: #333; margin-top: 0;">Hello ${
              emailData?.name || "Valued Applicant"
            }!</h2>
            <p style="font-size: 16px; color: #555;">We're writing to provide you with a comprehensive update on your application status.</p>

            <!-- Application Overview -->
            ${
              application?.application_people?.length
                ? `
            <h3 style="color: #495057;">👥 Application People Summary</h3>
            ${application.application_people
              .map((person, index) => {
                const personDocs = person?.documents || [];
                const totalDocs = personDocs.length;
                const approvedDocs = personDocs.filter(
                  (doc) => doc?.status === "APPROVED"
                ).length;
                const rejectedDocs = personDocs.filter(
                  (doc) => doc?.status === "REJECTED"
                ).length;
                const pendingDocs = personDocs.filter(
                  (doc) => doc?.status === "PENDING"
                ).length;

                return `
              <div class="summary-box" style="margin: 15px 0;">
                  <h4 style="margin-top: 0; color: white;">📊 Person ${
                    index + 1
                  } Document Summary</h4>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-top: 15px;">
                      <div style="text-align: center;">
                          <div style="font-size: 20px; font-weight: bold;">${totalDocs}</div>
                          <div style="opacity: 0.9; font-size: 12px;">Total</div>
                      </div>
                      <div style="text-align: center;">
                          <div style="font-size: 20px; font-weight: bold; color: #90EE90;">${approvedDocs}</div>
                          <div style="opacity: 0.9; font-size: 12px;">Approved</div>
                      </div>
                      <div style="text-align: center;">
                          <div style="font-size: 20px; font-weight: bold; color: #FFB6C1;">${rejectedDocs}</div>
                          <div style="opacity: 0.9; font-size: 12px;">Rejected</div>
                      </div>
                      <div style="text-align: center;">
                          <div style="font-size: 20px; font-weight: bold; color: #FFE4B5;">${pendingDocs}</div>
                          <div style="opacity: 0.9; font-size: 12px;">Pending</div>
                      </div>
                  </div>
              </div>
              `;
              })
              .join("")}
            `
                : '<p style="color: #666; font-style: italic;">No application people data available.</p>'
            }

            <!-- Application Details -->
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #495057; margin-top: 0;">📋 Application Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold; color: #666;">Category:</td>
                        <td style="padding: 8px 0;">${safeGet(
                          document_category,
                          "name"
                        )}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold; color: #666;">Status:</td>
                        <td style="padding: 8px 0;">
                            <span class="status-badge" style="background-color: ${getStatusColor(
                              emailData?.status
                            )}; color: white;">
                                ${getStatusIcon(emailData?.status)} ${
    emailData?.status || "Unknown"
  }
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold; color: #666;">Submitted:</td>
                        <td style="padding: 8px 0;">${formatDate(
                          emailData?.created_at
                        )}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold; color: #666;">Last Updated:</td>
                        <td style="padding: 8px 0;">${formatDate(
                          emailData?.updated_at
                        )}</td>
                    </tr>
                </table>
            </div>

            <!-- Documents Section -->
            ${
              application?.application_people?.length
                ? `
            <h3 style="color: #495057;">📄 Document Status</h3>
            ${application.application_people
              .map((person) =>
                person.documents
                  .map(
                    (doc) => `
                <div class="document-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4 style="margin: 0; color: #333;">${
                          doc.document_type?.name || "Unknown Document"
                        }</h4>
                        <span class="status-badge" style="background-color: ${getStatusColor(
                          doc.status
                        )}; color: white;">
                            ${getStatusIcon(doc.status)} ${doc.status}
                        </span>
                    </div>
                    ${
                      doc.document_type?.is_required
                        ? '<p style="margin: 5px 0; color: #dc3545; font-size: 12px;">🔴 Required Document</p>'
                        : '<p style="margin: 5px 0; color: #28a745; font-size: 12px;">🟢 Optional Document</p>'
                    }
                    ${
                      doc.review
                        ? `
                        <div style="background-color: white; padding: 10px; border-radius: 4px; margin-top: 10px;">
                            <strong>Review Comment:</strong>
                            <p style="margin: 5px 0; font-style: italic;">${
                              doc.review.comment || "No comment provided"
                            }</p>
                            <small style="color: #666;">Reviewed by: ${
                              doc.review.review_by
                                ? `${doc.review.review_by.first_name} ${doc.review.review_by.last_name}`
                                : "System"
                            }</small>
                        </div>
                    `
                        : ""
                    }
                </div>
              `
                  )
                  .join("")
              )
              .join("")}
            `
                : ""
            }

            <!-- Action Items -->
            <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #1976d2;">💡 Next Steps</h4>
                <ul style="margin: 10px 0;">
                    ${(() => {
                      try {
                        const allDocs =
                          application?.application_people?.flatMap(
                            (person) => person?.documents || []
                          ) || [];
                        const pendingDocs = allDocs.filter(
                          (doc) => doc?.status === "PENDING"
                        ).length;
                        const rejectedDocs = allDocs.filter(
                          (doc) => doc?.status === "REJECTED"
                        ).length;
                        const approvedDocs = allDocs.filter(
                          (doc) => doc?.status === "APPROVED"
                        ).length;
                        const totalDocs = allDocs.length;

                        let items = [];
                        if (pendingDocs > 0)
                          items.push(
                            "<li>Please wait for pending documents to be reviewed</li>"
                          );
                        if (rejectedDocs > 0)
                          items.push(
                            "<li>Consider resubmitting rejected documents with corrections</li>"
                          );
                        if (approvedDocs === totalDocs && totalDocs > 0)
                          items.push(
                            "<li>Congratulations! All documents have been approved</li>"
                          );
                        items.push(
                          "<li>You will be notified of any status changes</li>"
                        );

                        return items.join("");
                      } catch (error) {
                        return "<li>You will be notified of any status changes</li>";
                      }
                    })()}
                </ul>
            </div>

            <!-- Contact Information -->
            <div style="text-align: center; margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
                <h4 style="color: #495057; margin-top: 0;">Need Help?</h4>
                <p style="margin: 10px 0; color: #666;">If you have any questions about your application, please don't hesitate to contact our support team.</p>
                <p style="color: #666;">Thank you for your patience during the review process.</p>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #343a40; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 14px; opacity: 0.8;">This is an automated email regarding your application status.</p>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.6;">
                ${
                  domain
                    ? `Visit our website: ${domain}`
                    : "Embassy Application System"
                }
            </p>
        </div>
    </div>
</body>
</html>`;
};
export default applicationMailTemplate;
