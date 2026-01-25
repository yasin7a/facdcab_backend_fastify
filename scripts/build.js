import { build } from "esbuild";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const packageJson = require("../package.json");
// const serverConfig = await import('../config/server.config.js');
// const databaseUrl = serverConfig.DATABASE_URL; // for production

// Get command line arguments
const args = process.argv.slice(2);
const isProd = args.includes("--prod");

console.log(`Building for ${isProd ? "production" : "development"}...`);

// Define the entrypoint
const entryPoint = path.resolve(__dirname, "../server.js");

// Define output directory
const outdir = path.resolve(__dirname, "../dist");

// Clean the dist folder if it exists
if (fs.existsSync(outdir)) {
  fs.rmSync(outdir, { recursive: true, force: true });
}

// Create output directory
fs.mkdirSync(outdir, { recursive: true });

// Remove dev dependencies for production build
if (isProd) {
  delete packageJson.devDependencies;
}
fs.writeFileSync(
  path.join(outdir, "package.json"),
  JSON.stringify(packageJson, null, 2),
);

// // Copy .env file if it exists
// if (fs.existsSync(path.resolve(__dirname, "../.env"))) {
//   fs.copyFileSync(
//     path.resolve(__dirname, "../.env"),
//     path.join(outdir, ".env")
//   );
// }

// Create uploads folder in dist
const uploadsDir = path.join(outdir, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Build with esbuild
build({
  entryPoints: [entryPoint],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outdir: outdir,
  minify: isProd,
  sourcemap: !isProd,
  external: Object.keys(packageJson.dependencies || {}),
  banner: {
    js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
  },
  define: {
    "process.env.NODE_ENV": isProd ? '"production"' : '"development"',
  },
})
  .then(() => {
    console.log("Build completed!");
  })
  .catch((error) => {
    console.error("Build failed:", error);
    process.exit(1);
  });
