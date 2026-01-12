/**
 * Puppeteer Configuration
 *
 * Centralized configuration for PDF generation performance tuning
 * Modify these values to adjust Puppeteer behavior in your environment
 */

export const puppeteerConfig = {
  /**
   * Maximum number of PDFs to generate before restarting browser
   * Higher = Better performance, but potential memory leaks
   * Lower = More stable, but more restarts
   * Recommended: 10-20 for production
   */
  maxPagesBeforeRestart: 10,

  /**
   * Block unnecessary resources for faster PDF generation
   * Set to false if you need images/CSS in PDFs
   */
  blockResourcesByDefault: false,

  /**
   * Resources to block when blockResources is enabled
   */
  blockedResourceTypes: ["image", "stylesheet", "font", "media"],

  /**
   * Default page wait strategy
   * Options: 'load', 'domcontentloaded', 'networkidle0', 'networkidle2'
   *
   * - 'domcontentloaded': Fastest (recommended for simple HTML)
   * - 'networkidle0': Slowest but most reliable (for complex pages)
   */
  defaultWaitUntil: "domcontentloaded",

  /**
   * Default timeout in milliseconds
   */
  defaultTimeout: 15000,

  /**
   * Browser launch arguments
   * These are optimized for production/Docker environments
   * Note: --single-process and --no-zygote are only used on Linux (unstable on Windows)
   */
  browserArgs: [
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
  ],

  /**
   * PDF generation defaults
   */
  pdfDefaults: {
    format: "A4",
    printBackground: true,
    margin: {
      top: "20px",
      right: "20px",
      bottom: "20px",
      left: "20px",
    },
  },

  /**
   * Enable/disable browser warmup on server start
   * Set to true for production to pre-launch browser
   */
  warmupOnStart: false,

  /**
   * Logging preferences
   */
  logging: {
    browserLaunch: true,
    browserClose: true,
    browserRestart: true,
    pageGeneration: false, // Set to true for debugging
  },
};

export default puppeteerConfig;
