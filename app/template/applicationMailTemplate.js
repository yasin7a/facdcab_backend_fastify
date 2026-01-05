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

  // Get all rejected documents
  const rejectedDocuments = [];
  if (application?.application_people?.length) {
    application.application_people.forEach((person, personIndex) => {
      person.documents?.forEach((doc) => {
        if (doc.status === "REJECTED") {
          rejectedDocuments.push({
            ...doc,
            personIndex: personIndex + 1,
          });
        }
      });
    });
  }

  const rejectedCount = rejectedDocuments.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Verification Notice</title>
</head>
<body style="margin: 0; padding: 40px 0; background-color: #f4f4f4; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e1e1e1; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
        
        <div style="background-color: #006747; padding: 24px 30px; display: flex; align-items: center;">
            <div style="background-color: white; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; margin-right: 18px; flex-shrink: 0;">
                <img src="https://upload.wikimedia.org/wikipedia/commons/f/f9/Flag_of_Bangladesh.svg" alt="BD Flag" style="width: 30px; height: auto;">
            </div>
            <div style="color: white;">
                <h1 style="margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">Bangladesh High Commission</h1>
                <p style="margin: 2px 0 0 0; font-size: 13px; opacity: 0.85;">Document Verification Notice</p>
            </div>
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
            <p style="margin: 0 0 25px 0; font-size: 14px; line-height: 1.6; color: #4a5568;">Thank you for your appointment booking with the Bangladesh High Commission. ${
              rejectedCount > 0
                ? "After reviewing your submitted documents, we found that some documents do not meet our requirements and need to be re-uploaded."
                : "We are reviewing your submitted documents and will notify you of any updates."
            }</p>

            <div style="background-color: #f0f7ff; border-radius: 10px; padding: 22px; margin-bottom: 30px; border: 1px solid #d0e3ff;">
                <div style="display: flex; align-items: center; margin-bottom: 18px; color: #2b6cb0;">
                    <strong style="font-size: 15px; letter-spacing: 0.3px;">Appointment Information</strong>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px; font-size: 13px;">
                    <div>
                        <div style="color: #718096; margin-bottom: 4px;">Appointment ID:</div>
                        <div style="font-weight: 600; color: #2d3748;">${
                          emailData?.application_id || "N/A"
                        }</div>
                    </div>
                    <div>
                        <div style="color: #718096; margin-bottom: 4px;">Service Category:</div>
                        <div style="font-weight: 600; color: #2d3748;">${safeGet(
                          document_category,
                          "name"
                        )}</div>
                    </div>
                    <div>
                        <div style="color: #718096; margin-bottom: 4px;">Submitted Date:</div>
                        <div style="font-weight: 600; color: #2d3748;">${formatDate(
                          emailData?.created_at
                        )}</div>
                    </div>
                    <div>
                        <div style="color: #718096; margin-bottom: 4px;">Email:</div>
                        <div style="font-weight: 600; color: #2d3748;">${
                          emailData?.email || "N/A"
                        }</div>
                    </div>
                </div>
            </div>

            ${
              rejectedCount > 0
                ? `
            <div style="display: flex; align-items: center; margin-bottom: 18px; color: #c53030;">
                <strong style="font-size: 15px;">Rejected Documents (${rejectedCount})</strong>
            </div>

            ${rejectedDocuments
              .map(
                (doc, index) => `
            <div style="border: 1px solid #fed7d7; border-radius: 8px; margin-bottom: 18px; overflow: hidden;">
                <div style="padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; background-color: #fff;">
                    <div style="display: flex; align-items: center;">
                        <span style="background: #e53e3e; color: white; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; margin-right: 12px;">${
                          index + 1
                        }</span>
                        <span style="font-weight: 600; font-size: 14px; color: #2d3748;">${
                          doc.document_type?.name || "Unknown Document"
                        }</span>
                    </div>
                    <span style="background: #e53e3e; color: white; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Rejected</span>
                </div>
                <div style="background-color: #fff5f5; margin: 0 15px 15px 15px; padding: 15px; border-radius: 6px; border: 1px solid #feb2b2;">
                    <div style="font-size: 12px; font-weight: 700; color: #c53030; margin-bottom: 6px;">Rejection Reason:</div>
                    <div style="font-size: 12px; color: #742a2a; line-height: 1.5;">${
                      doc.review?.comment ||
                      "The document does not meet our requirements. Please review and resubmit."
                    }</div>
                </div>
            </div>
            `
              )
              .join("")}

            <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 22px; margin: 30px 0;">
                <div style="display: flex; align-items: center; margin-bottom: 12px; color: #92400e;">
                    <strong style="font-size: 14px;">Action Required</strong>
                </div>
                <p style="font-size: 13px; margin: 0 0 12px 0; line-height: 1.5; color: #78350f;">Please re-upload the corrected documents within <strong>2 days</strong> to avoid appointment cancellation. Ensure all documents meet the following requirements:</p>
                <ul style="font-size: 12px; margin: 0; padding-left: 20px; color: #92400e; line-height: 1.8;">
                    <li>Clear and readable scanned copy or high-quality photograph</li>
                    <li>All four corners of the document must be visible</li>
                    <li>File format: PDF, JPG, or PNG (Max 5 MB)</li>
                    <li>No edited or tampered documents will be accepted</li>
                </ul>
            </div>

            <div style="text-align: center; margin-bottom: 10px;">
                <a href="#" style="background-color: #006747; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; transition: background 0.2s;">
                    Upload All Documents Now
                </a>
                <p style="font-size: 11px; color: #a0aec0; margin-top: 15px;">Click the button above to access your document upload portal</p>
            </div>
            `
                : `
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 22px; margin: 30px 0;">
                <div style="display: flex; align-items: center; margin-bottom: 12px; color: #166534;">
                    <strong style="font-size: 14px;">Status Update</strong>
                </div>
                <p style="font-size: 13px; margin: 0; line-height: 1.5; color: #166534;">Your documents are currently under review. You will be notified once the review process is complete.</p>
            </div>
            `
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
            <div style="font-weight: 700; color: white; margin-bottom: 8px; letter-spacing: 0.5px;">Bangladesh High Commission</div>
            <div style="margin-bottom: 25px; opacity: 0.8;">House 12, Road 108, Gulshan-2, Dhaka 1212, Bangladesh</div>
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
