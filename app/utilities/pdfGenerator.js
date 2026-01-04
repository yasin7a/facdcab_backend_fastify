import puppeteer from "puppeteer";
import throwError from "./throwError.js";
import httpStatus from "./httpStatus.js";

/**
 * Generate PDF from HTML content using Puppeteer
 * @param {Object} options - PDF generation options
 * @param {string} options.html - HTML content to convert to PDF
 * @param {Object} options.pdfOptions - Puppeteer PDF options
 * @param {Object} options.pageOptions - Page configuration options
 * @param {Object} options.browserOptions - Browser launch options
 * @returns {Promise<Buffer>} PDF buffer
 */
const generatePDF = async (options = {}) => {
  const {
    html,
    pdfOptions = {},
    pageOptions = {},
    browserOptions = {},
  } = options;

  if (!html) {
    throw throwError(
      httpStatus.BAD_REQUEST,
      "HTML content is required for PDF generation"
    );
  }

  let browser;
  let page;

  try {
    // Default browser options
    const defaultBrowserOptions = {
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
      ...browserOptions,
    };

    // Launch browser
    browser = await puppeteer.launch(defaultBrowserOptions);
    page = await browser.newPage();

    // Default page options
    const defaultPageOptions = {
      waitUntil: "networkidle0",
      timeout: 30000,
      ...pageOptions,
    };

    // Set page content
    await page.setContent(html, defaultPageOptions);

    // Default PDF options
    const defaultPdfOptions = {
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
      ...pdfOptions,
    };

    // Generate PDF
    const pdfBuffer = await page.pdf(defaultPdfOptions);

    return pdfBuffer;
  } catch (error) {
    console.error("PDF Generation Error:", error);
    throw throwError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `PDF generation failed: ${error.message}`
    );
  } finally {
    // Clean up resources
    try {
      if (page) await page.close();
      if (browser) await browser.close();
    } catch (cleanupError) {
      console.error("PDF cleanup error:", cleanupError);
    }
  }
};

/**
 * Generate PDF from template with data
 * @param {Object} options - Template PDF options
 * @param {Function} options.template - Template function that returns HTML
 * @param {Object} options.data - Data to pass to template
 * @param {Object} options.pdfOptions - PDF generation options
 * @param {string} options.filename - Optional filename for the PDF
 * @returns {Promise<Buffer>} PDF buffer
 */
const generatePDFFromTemplate = async (options = {}) => {
  const { template, data = {}, pdfOptions = {}, filename } = options;

  if (!template || typeof template !== "function") {
    throw throwError(httpStatus.BAD_REQUEST, "Template function is required");
  }

  try {
    // Generate HTML from template
    const html = template(data);

    if (!html || typeof html !== "string") {
      throw throwError(
        httpStatus.BAD_REQUEST,
        "Template must return valid HTML string"
      );
    }

    // Generate PDF
    const pdfBuffer = await generatePDF({
      html,
      pdfOptions,
    });

    return pdfBuffer;
  } catch (error) {
    console.error("Template PDF Generation Error:", error);
    throw throwError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      `Template PDF generation failed: ${error.message}`
    );
  }
};

/**
 * Send PDF as response with proper headers
 * @param {Object} reply - Fastify reply object
 * @param {Buffer} pdfBuffer - PDF buffer
 * @param {string} filename - Filename for download
 * @param {boolean} inline - Whether to display inline or as attachment
 */
const sendPDFResponse = (
  reply,
  pdfBuffer,
  filename = "document.pdf",
  inline = false
) => {
  try {
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
      throw throwError(httpStatus.BAD_REQUEST, "Valid PDF buffer is required");
    }

    const disposition = inline ? "inline" : "attachment";

    reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `${disposition}; filename="${filename}"`)
      .header("Content-Length", pdfBuffer.length)
      .send(pdfBuffer);
  } catch (error) {
    console.error("PDF Response Error:", error);
    throw throwError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to send PDF response: ${error.message}`
    );
  }
};

export { generatePDF, generatePDFFromTemplate, sendPDFResponse };
