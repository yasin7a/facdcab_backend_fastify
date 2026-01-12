import puppeteer from "puppeteer";
import throwError from "./throwError.js";
import httpStatus from "./httpStatus.js";

// Browser instance pool for production performance
let browserInstance = null;
let browserPromise = null;
let pageCount = 0;
const MAX_PAGES = 10; // Restart browser after this many pages to prevent memory leaks

/**
 * Get or create browser instance (singleton pattern for performance)
 * @param {Object} browserOptions - Browser launch options
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
const getBrowser = async (browserOptions = {}) => {
  // If browser is being launched, wait for it
  if (browserPromise) {
    return browserPromise;
  }

  // If browser exists and is connected, return it
  if (browserInstance?.connected) {
    return browserInstance;
  }

  // Launch new browser
  browserPromise = (async () => {
    try {
      // Platform-specific args (avoid --single-process on Windows)
      const isWindows = process.platform === "win32";

      const defaultBrowserOptions = {
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-software-rasterizer",
          "--disable-background-networking",
          "--disable-default-apps",
          "--disable-sync",
          "--disable-translate",
          "--hide-scrollbars",
          "--metrics-recording-only",
          "--mute-audio",
          "--no-default-browser-check",
          "--safebrowsing-disable-auto-update",
          // Add Linux-specific args only
          ...(!isWindows ? ["--no-zygote", "--single-process"] : []),
        ],
        ...browserOptions,
      };

      // Try to launch browser with retry logic
      let browser = null;
      let lastError = null;
      const maxRetries = 2;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          browser = await puppeteer.launch(defaultBrowserOptions);
          break; // Success!
        } catch (error) {
          lastError = error;
          console.error(
            `❌ Browser launch attempt ${attempt}/${maxRetries} failed:`,
            error.message
          );

          if (attempt < maxRetries) {
            console.log("🔄 Retrying browser launch...");
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before retry
          }
        }
      }

      if (!browser) {
        console.error("❌ Failed to launch browser after all retries");
        browserPromise = null;
        throw lastError;
      }

      // Handle browser disconnect
      browser.on("disconnected", () => {
        console.warn("⚠️  Puppeteer browser disconnected");
        browserInstance = null;
        browserPromise = null;
        pageCount = 0;
      });

      console.log("✅ Puppeteer browser launched");
      return browser;
    } catch (error) {
      console.error("❌ Browser launch error:", error.message);
      browserPromise = null;
      throw error;
    }
  })();

  browserInstance = await browserPromise;
  browserPromise = null;
  pageCount = 0;

  return browserInstance;
};

/**
 * Restart browser if it's been used too many times (prevent memory leaks)
 */
const maybeRestartBrowser = async () => {
  pageCount++;

  if (pageCount >= MAX_PAGES && browserInstance?.connected) {
    console.log(`🔄 Restarting browser after ${pageCount} pages`);
    try {
      await browserInstance.close();
    } catch (error) {
      console.error("Error closing browser:", error.message);
    }
    browserInstance = null;
    browserPromise = null;
    pageCount = 0;
  }
};

/**
 * Close browser instance (call on server shutdown)
 */
const closeBrowser = async () => {
  if (browserInstance?.connected) {
    try {
      await browserInstance.close();
      console.log("✅ Puppeteer browser closed");
    } catch (error) {
      console.error("Error closing browser:", error.message);
    }
  }
  browserInstance = null;
  browserPromise = null;
  pageCount = 0;
};

/**
 * Warm up browser on server start (optional - for faster first PDF)
 * This pre-launches the browser so the first PDF generation is faster
 */
const warmupBrowser = async () => {
  try {
    console.log("🔥 Warming up Puppeteer browser...");
    await getBrowser();
    console.log("✅ Puppeteer browser warmed up and ready");
  } catch (error) {
    console.error("⚠️  Browser warmup failed (non-critical):", error.message);
  }
};

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
    blockResources = true, // Block images/css/fonts for faster generation
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
    // Get or create shared browser instance (much faster than launching each time)
    browser = await getBrowser(browserOptions);
    page = await browser.newPage();

    // Set resource limits to improve performance (optional)
    if (blockResources) {
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        // Block unnecessary resources to speed up PDF generation
        const resourceType = request.resourceType();
        if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
    }

    // Default page options with shorter timeout for production
    const defaultPageOptions = {
      waitUntil: "domcontentloaded", // Faster than networkidle0
      timeout: 15000, // Reduced from 30s
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
    const pdfData = await page.pdf(defaultPdfOptions);

    // Ensure we return a proper Node.js Buffer
    const pdfBuffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData);

    // Check if browser needs restart
    await maybeRestartBrowser();

    return pdfBuffer;
  } catch (error) {
    console.error("PDF Generation Error:", error);
    throw throwError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `PDF generation failed: ${error.message}`
    );
  } finally {
    // Clean up page only (keep browser instance alive)
    try {
      if (page) await page.close();
      // Note: We don't close the browser - it's reused for performance
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
  const {
    template,
    data = {},
    pdfOptions = {},
    pageOptions = {},
    filename,
  } = options;

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
      pageOptions,
    });

    return pdfBuffer;
  } catch (error) {
    console.error("Template PDF Generation Error:", {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    });
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

export {
  generatePDF,
  generatePDFFromTemplate,
  sendPDFResponse,
  closeBrowser,
  warmupBrowser,
};
