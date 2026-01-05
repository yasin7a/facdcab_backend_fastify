import QRCode from "qrcode";

const generateQRCode = async (data, size = 300) => {
  try {
    const qrCodeDataURL = await QRCode.toDataURL(data, {
      width: size,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error("QR Code generation error:", error);
    throw error;
  }
};

const generateApplicationVisitPass = async (applicationData) => {
  try {
    const verificationData = JSON.stringify({
      id: applicationData.id,
      applicant: applicationData.applicant_name,
      date: applicationData.appointment_date,
      time: applicationData.appointment_time,
      category: applicationData.category,
    });

    const qrCode = await generateQRCode(verificationData, 200);

    return {
      qrCode,
    };
  } catch (error) {
    console.error("Verification codes generation error:", error);
    return {
      qrCode: null,
    };
  }
};

export { generateQRCode, generateApplicationVisitPass };
