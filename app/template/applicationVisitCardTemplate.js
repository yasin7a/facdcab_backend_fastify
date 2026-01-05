const applicationTemplate = (data) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Appointment Pass - ${data.id || "APT-2024-001"}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        @page {
            size: A4;
            margin: 0;
        }
        body {
            margin: 0;
            padding: 0;
            background-color: #ffffff;
            font-family: 'Segoe UI', Arial, sans-serif;
            -webkit-print-color-adjust: exact;
        }
        .container {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm;
            margin: 0 auto;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
        }
        .header {
            background-color: #006747;
            color: white;
            padding: 30px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .id-badge {
            background-color: #f8fafc;
            border-left: 6px solid #006747;
            padding: 20px;
            margin: 25px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .status-box {
            border: 2px solid #22c55e;
            color: #166534;
            padding: 10px 20px;
            border-radius: 10px;
            text-align: center;
            font-weight: bold;
        }

        /* Adjusted QR Section to be smaller and balanced */
        .verification-center {
            text-align: center;
            margin: 20px 0; /* Reduced margin */
            padding: 20px;
            border: 1px dashed #e2e8f0; /* Thinner border */
            border-radius: 15px;
        }
        .qr-large {
            width: 200px;
            height: 200px;
            margin: 0 auto 10px auto;
            display: block;
        }

        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        .label { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
        .value { font-size: 16px; font-weight: 600; color: #1e293b; margin-top: 4px; }

        .instructions {
            background-color: #fffbeb;
            border: 1px solid #fef3c7;
            padding: 25px;
            border-radius: 10px;
            color: #92400e;
        }
        .footer {
            margin-top: auto;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
        }
    </style>
</head>
<body>

<div class="container">
    <div class="header">
        <div>
            <h1 style="margin: 0; font-size: 26px;">Appointment Confirmation Pass</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Bangladesh High Commission, London</p>
        </div>
        <i class="fas fa-passport" style="font-size: 40px; opacity: 0.5;"></i>
    </div>

    <div class="id-badge">
        <div>
            <div class="label">Appointment ID</div>
            <div style="font-size: 32px; font-weight: 800; color: #006747;">${
              data.id || "APT-2024-001"
            }</div>
        </div>
        <div class="status-box">
            <i class="fas fa-check-circle" style="font-size: 20px;"></i><br>
            ${(data.status || "CONFIRMED").toUpperCase()}
        </div>
    </div>

    <div class="verification-center">
        <div class="label" style="margin-bottom: 10px;">Official QR Verification Code</div>
        ${
          data.qrCode
            ? `<img src="${data.qrCode}" alt="QR Code" class="qr-large" />`
            : '<div class="qr-large" style="background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8;">QR Code</div>'
        }
        <div style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 10px;">Scan this code at the reception desk</div>
        <div style="font-family: 'Courier New', Courier, monospace; font-weight: bold; font-size: 16px; color: #1e293b;">${
          data.id || "APT-2024-001"
        }</div>
    </div>

    <div class="info-grid">
        <div>
            <div class="label">Applicant Name</div>
            <div class="value">${data.applicant_name || "N/A"}</div>
            <div style="margin-top: 15px;" class="label">Appointment Date</div>
            <div class="value"><i class="far fa-calendar-alt"></i> ${
              data.appointment_date
                ? new Date(data.appointment_date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "N/A"
            }</div>
        </div>
        <div>
            <div class="label">Category</div>
            <div class="value">${data.category || "Visa Application"}</div>
            <div style="margin-top: 15px;" class="label">Appointment Time</div>
            <div class="value"><i class="far fa-clock"></i> ${
              data.appointment_time || "N/A"
            }</div>
        </div>
    </div>

    <div class="instructions">
        <div style="font-weight: bold; margin-bottom: 10px; display: flex; align-items: center;">
            <i class="fas fa-info-circle" style="margin-right: 8px;"></i> Important Instructions
        </div>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
            <li>Please arrive 15 minutes before your scheduled appointment time.</li>
            <li>Carry this printed pass and all original documents.</li>
            <li>Valid photo ID is mandatory for security clearance.</li>
            <li>Electronics and mobile phones are restricted inside the premises.</li>
        </ul>
    </div>

    <div class="footer">
        <div style="margin-bottom: 5px;"><strong>Venue:</strong> 28 Queen's Gate, London SW7 5JA, United Kingdom</div>
        Generated on ${new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })} at ${new Date().toLocaleTimeString("en-US", {
  hour: "2-digit",
  minute: "2-digit",
})} • This document is legally valid for entry.
    </div>
</div>

</body>
</html>
`;
export default applicationTemplate;
